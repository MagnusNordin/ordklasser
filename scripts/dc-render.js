// Minimal renderer for the design canvas's .dc.html artboards.
// Runs in the browser (injected by capture-design.mjs). It supports the
// subset of the format the Ordklasser artboards use: {{holes}}, <sc-if>,
// <sc-for>, onClick handlers and a DCLogic component with props and state.
(function () {
  function lookup(scope, path) {
    return path.split('.').reduce(function (v, k) { return v == null ? undefined : v[k]; }, scope);
  }
  var WHOLE = /^\{\{\s*([\w.$]+)\s*\}\}$/;
  var PART = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function interp(text, scope) {
    return text.replace(PART, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }

  function renderChildren(src, out, scope) {
    src.childNodes.forEach(function (n) { renderNode(n, out, scope); });
  }

  function renderNode(node, out, scope) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && lookup(scope, m[1])) renderChildren(node.content || node, out, scope);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || '');
      var list = (lm && lookup(scope, lm[1])) || [];
      var as = node.getAttribute('as');
      list.forEach(function (item) {
        var inner = Object.create(scope);
        inner[as] = item;
        renderChildren(node, out, inner);
      });
      return;
    }
    var el = node.cloneNode(false);
    Array.from(node.attributes).forEach(function (a) {
      var name = a.name;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); return; }
      var whole = WHOLE.exec(a.value);
      if (name.indexOf('on') === 0) {
        el.removeAttribute(name);
        var fn = whole && lookup(scope, whole[1]);
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
        return;
      }
      if (whole) {
        var v = lookup(scope, whole[1]);
        if (v === false || v == null) el.removeAttribute(name);
        else if (v === true) el.setAttribute(name, '');
        else el.setAttribute(name, String(v));
      } else if (a.value.indexOf('{{') >= 0) {
        el.setAttribute(name, interp(a.value, scope));
      }
    });
    renderChildren(node, el, scope);
    out.appendChild(el);
  }

  // Renders `source` (the full .dc.html text) into `mount` with `props`.
  window.renderDC = function (source, mount, props) {
    var doc = new DOMParser().parseFromString(source, 'text/html');
    var xdc = doc.querySelector('x-dc');
    var helmet = xdc.querySelector('helmet');
    if (helmet) {
      Array.from(helmet.children).forEach(function (c) { document.head.appendChild(document.importNode(c, true)); });
      helmet.remove();
    }
    var script = doc.querySelector('script[data-dc-script]');
    var declared = JSON.parse(script.getAttribute('data-props') || '{}');
    var fullProps = {};
    Object.keys(declared).forEach(function (k) { if (k[0] !== '$' && 'default' in declared[k]) fullProps[k] = declared[k].default; });
    Object.assign(fullProps, props || {});

    function DCLogic(p) { this.props = p; this.state = null; }
    DCLogic.prototype.setState = function (patch) {
      this.state = Object.assign({}, this.state, patch);
      draw();
    };
    var Component = new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic);
    var comp = new Component(fullProps);
    function draw() {
      mount.textContent = '';
      renderChildren(xdc, mount, comp.renderVals());
    }
    draw();
    return comp;
  };
})();
