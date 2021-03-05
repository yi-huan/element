let lnsId = 0;
let currentId;
const dragObjs = {};

/**
 * 获取唯一 id
 * @returns {number}
 */
function lnsNextId() { return ++lnsId; }

function changeInstanceStatus(vnode, status) {
  if (vnode.data.attrs && vnode.data.attrs['data-drag-status']) {
    vnode.context[vnode.data.attrs['data-drag-status']] = status;
  }
}

function onStart(item) {
  return function(event) {
    item.el.style.cursor = 'move';
    document.body.style.cursor = 'move';

    changeInstanceStatus(item.vnode, 'start');

    const isTouch = event.type === 'touchstart';
    if (!isTouch) event.preventDefault();

    const eventPoint = isTouch ? event.touches[0] : event;

    currentId = item.id;
    item.el._lns_lastCoords = item.el._lns_firstCoords = {
      x: eventPoint.clientX,
      y: eventPoint.clientY
    };
    item.clientWidth = window.innerWidth;
    item.clientHeight = window.innerHeight;
    // 如果表达式的值是要移动的元素
    if (item.modifiers.isWrapEl) {
      item.wrapEl = item.fn({ el: item.el, status: 'start'});
      const wrapRect = item.wrapEl.getBoundingClientRect();
      const wrapElStyle = window.getComputedStyle(item.wrapEl);
      const left = +wrapElStyle.left.slice(0, -2) || 0;
      const top = +wrapElStyle.top.slice(0, -2) || 0;

      item.wrapWidth = wrapRect.width || wrapRect.right - wrapRect.left;
      item.wrapHeight = wrapRect.height || wrapRect.bottom - wrapRect.top;

      // 允许的边框位置
      if (item.arg === 'parentLimit') {
        item.allowTop = Math.floor(top - wrapRect.top);
        item.allowRight = Math.floor(left + item.clientWidth - wrapRect.right);
        item.allowBottom = Math.floor(top + item.clientHeight - wrapRect.bottom);
        item.allowLeft = Math.floor(left - wrapRect.left);
      }

      item.startWrapTop = top;
      item.startWrapLeft = left;

      item.startClientX = eventPoint.clientX;
      item.startClientY = eventPoint.clientY;
    } else {
      item.fn({
        event,
        el: item.el,
        arg: item.arg,
        status: 'start',
        clientX: eventPoint.clientX,
        clientY: eventPoint.clientY,
        clientWidth: item.clientWidth,
        clientHeight: item.clientHeight
      });
    }

    item.onMove = onMove(item);
    document.addEventListener('mousemove', item.onMove);
    document.addEventListener('touchmove', item.onMove);

    item.onEnd = onEnd(item);

    document.addEventListener('mouseup', item.onEnd);
    document.addEventListener('touchend', item.onEnd);
  };
}
function onMove(item) {
  return function(event) {
    if (!currentId) {
      return;
    }

    changeInstanceStatus(item.vnode, 'move');

    const isTouch = event.type === 'touchmove';
    if (!isTouch) event.preventDefault();

    const eventPoint = isTouch ? event.touches[0] : event;

    if (item.el._lns_lastCoords) {
      const clientX = eventPoint.clientX;
      const clientY = eventPoint.clientY;
      const deltaX = eventPoint.clientX - item.el._lns_lastCoords.x;
      const deltaY = eventPoint.clientY - item.el._lns_lastCoords.y;
      const offsetX = eventPoint.clientX - item.el._lns_firstCoords.x;
      const offsetY = eventPoint.clientY - item.el._lns_firstCoords.y;

      // 如果有移动的元素
      if (item.wrapEl) {
        // const wrapElStyle = window.getComputedStyle(item.wrapEl);
        // const left = +wrapElStyle.left.slice(0, -2) || 0;
        // const top = +wrapElStyle.top.slice(0, -2) || 0;
        // item.wrapEl.style.left = left + deltaX + 'px';
        // item.wrapEl.style.top = top + deltaY + 'px';
        const wrapTop = item.startWrapTop + clientY - item.startClientY;
        const wrapLeft = item.startWrapLeft + clientX - item.startClientX;
        item.wrapEl.style.top = (item.arg === 'parentLimit' ? Math.min(Math.max(wrapTop, item.allowTop), item.allowBottom) : wrapTop) + 'px';
        item.wrapEl.style.left = (item.arg === 'parentLimit' ? Math.min(Math.max(wrapLeft, item.allowLeft), item.allowRight) : wrapLeft) + 'px';
      } else {
        item.fn({
          event,
          el: item.el,
          arg: item.arg,
          status: 'move',
          deltaX,
          deltaY,
          offsetX,
          offsetY,
          clientX,
          clientY,
          clientWidth: item.clientWidth,
          clientHeight: item.clientHeight
        });
      }

      item.el._lns_lastCoords = {
        x: eventPoint.clientX,
        y: eventPoint.clientY
      };
    }
  };
}
function onEnd(item) {
  return function(event) {
    if (!currentId) {
      return;
    }
    document.body.style.cursor = '';
    item.el.style.cursor = 'grab';

    currentId = null;
    item.wrapEl = null;
    const isTouch = event.type === 'touchend';
    if (!isTouch) event.preventDefault();

    const eventPoint = isTouch ? event.changedTouches[0] : event;

    item.el._lns_lastCoords = null;
    item.fn({
      event,
      el: item.el,
      arg: item.arg,
      status: 'end',
      clientX: eventPoint.clientX,
      clientY: eventPoint.clientY
    });
    document.removeEventListener('mousemove', item.onMove);
    document.removeEventListener('touchmove', item.onMove);
    document.removeEventListener('mouseup', item.onEnd);
    document.removeEventListener('touchend', item.onEnd);

    changeInstanceStatus(item.vnode, 'end');
  };
}

export default {
  inserted(el, binding, vnode) {
    // console.log('ebinding', binding);
    if (typeof binding.value === 'function' || (typeof binding.value === 'object' && typeof binding.value.value === 'function')) {
      const id = lnsNextId();
      el.__lns_drag_id = id;

      const item = {
        id,
        fn: typeof binding.value === 'function' ? binding.value : binding.value.value,
        el,
        vnode,
        arg: binding.arg || binding.value.arg || {},
        modifiers: binding.modifiers || {}
      };

      el.style.cursor = 'grab';

      item.onStart = onStart(item);
      el.addEventListener('mousedown', item.onStart);
      el.addEventListener('touchstart', item.onStart);

      dragObjs[id] = item;
    }
  },

  unbind(el, binding) {
    if (typeof binding.value === 'function') {
      const item = dragObjs[el.__lns_drag_id];
      if (!item) return;
      el.removeEventListener('mousedown', item.onStart);
      el.removeEventListener('touchstart', item.onStart);
      delete dragObjs[el.__lns_drag_id];
    }
  }
};
