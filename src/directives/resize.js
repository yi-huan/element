let isResizing;
let lnsId = 0;
const resizeObjs = {};

function lnsNextId() { return ++lnsId; }

export default {
  inserted(el, binding) {
    const triggerEle = document.createElement('div');
    triggerEle.style.position = 'absolute';
    triggerEle.style.right = '0';
    triggerEle.style.bottom = '0';
    triggerEle.style.width = '8px';
    triggerEle.style.height = '8px';
    triggerEle.style.cursor = 'nwse-resize';

    function onStart(event) {
      isResizing = true;
      const isTouch = event.type === 'touchstart';
      const eventPoint = isTouch ? event.touches[0] : event;

      const wrapElStyle = window.getComputedStyle(el);
      const width = +wrapElStyle.width.slice(0, -2) || 0;
      const height = +wrapElStyle.height.slice(0, -2) || 0;
      const clientX = eventPoint.clientX;
      const clientY = eventPoint.clientY;

      if (typeof binding.value === 'function') {
        binding.value({
          status: 'start',
          el,
          clientX,
          clientY,
          width,
          height
        });
      }

      function onMove(event) {
        if (!isResizing) return;
        if (!isTouch) event.preventDefault();

        const moveEventPoint = isTouch ? event.touches[0] : event;
        const moveClientX = moveEventPoint.clientX;
        const moveClientY = moveEventPoint.clientY;
        let result;
        if (typeof binding.value === 'function') {
          result = binding.value({
            status: 'move',
            el,
            clientX: moveClientX,
            clientY: moveClientY
          });
        }
        if (typeof result === 'function') {
          result({
            startWidth: width,
            startHeight: height,
            startClientX: clientX,
            startClientY: clientY,
            el,
            moveClientX,
            moveClientY
          });
        } else {
          el.style.width = (width + moveClientX - clientX) + 'px';
          el.style.height = (height + moveClientY - clientY) + 'px';
        }
      }

      function onEnd(event) {
        if (!isResizing) return;
        isResizing = false;
        if (!isTouch) event.preventDefault();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        if (typeof binding.value === 'function') {
          binding.value({
            status: 'end',
            el
          });
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove);

      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchend', onEnd);
    }

    el.appendChild(triggerEle);

    const id = lnsNextId();
    el.__lns_resize_id = id;

    resizeObjs[id] = {
      triggerEle
    };

    if (typeof binding.value === 'function') {
      binding.value({
        status: 'init'
      });
    }

    triggerEle.addEventListener('mousedown', onStart);
    triggerEle.addEventListener('touchstart', onStart);
  },

  unbind(el, binding) {
    if (el.__lns_resize_id && resizeObjs[el.__lns_resize_id]) {
      el.removeChild(resizeObjs[el.__lns_resize_id].triggerEle);
      delete resizeObjs[el.__lns_resize_id];
    }
  }
};

