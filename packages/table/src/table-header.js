import Vue from 'vue';
import { hasClass, addClass, removeClass } from 'yh-element/src/utils/dom';
import ElCheckbox from 'yh-element/packages/checkbox';
import FilterPanel from './filter-panel.vue';
import LayoutObserver from './layout-observer';
import { mapStates } from './store/helper';

const getAllColumns = (columns) => {
  const result = [];
  columns.forEach((column) => {
    if (column.children) {
      result.push(column);
      result.push.apply(result, getAllColumns(column.children));
    } else {
      result.push(column);
    }
  });
  return result;
};

const convertToRows = (originColumns) => {
  let maxLevel = 1;
  const traverse = (column, parent) => {
    if (parent) {
      column.level = parent.level + 1;
      if (maxLevel < column.level) {
        maxLevel = column.level;
      }
    }
    if (column.children) {
      let colSpan = 0;
      column.children.forEach((subColumn) => {
        traverse(subColumn, column);
        colSpan += subColumn.colSpan;
      });
      column.colSpan = colSpan;
    } else {
      column.colSpan = 1;
    }
  };

  originColumns.forEach((column) => {
    column.level = 1;
    traverse(column);
  });

  const rows = [];
  for (let i = 0; i < maxLevel; i++) {
    rows.push([]);
  }

  const allColumns = getAllColumns(originColumns);

  allColumns.forEach((column) => {
    if (!column.children) {
      column.rowSpan = maxLevel - column.level + 1;
    } else {
      column.rowSpan = 1;
    }
    rows[column.level - 1].push(column);
  });

  return rows;
};

export default {
  name: 'ElTableHeader',

  mixins: [LayoutObserver],

  render(h) {
    const originColumns = this.store.states.originColumns;
    const columnRows = convertToRows(originColumns, this.columns);
    // 是否拥有多级表头
    const isGroup = columnRows.length > 1;
    if (isGroup) this.$parent.isGroup = true;
    return (
      <table
        class="el-table__header"
        cellspacing="0"
        cellpadding="0"
        border="0">
        <colgroup>
          {
            this.columns.map(column => <col name={ column.id } key={column.id} />)
          }
          {
            this.hasGutter ? <col name="gutter" /> : ''
          }
        </colgroup>
        <thead class={ [{ 'is-group': isGroup, 'has-gutter': this.hasGutter }] }>
          {
            this._l(columnRows, (columns, rowIndex) =>
              <tr
                style={ this.getHeaderRowStyle(rowIndex) }
                class={ this.getHeaderRowClass(rowIndex) }
              >
                {
                  columns.map((column, cellIndex) => (<th
                    colspan={ column.colSpan }
                    rowspan={ column.rowSpan }
                    on-mousemove={ ($event) => this.handleMouseMove($event, column, cellIndex) }
                    on-mouseout={ this.handleMouseOut }
                    on-mousedown={ ($event) => this.handleMouseDown($event, column, cellIndex) }
                    on-click={ ($event) => this.handleHeaderClick($event, column) }
                    on-contextmenu={ ($event) => this.handleHeaderContextMenu($event, column) }
                    style={ this.getHeaderCellStyle(rowIndex, cellIndex, columns, column) }
                    class={ this.getHeaderCellClass(rowIndex, cellIndex, columns, column) }
                    key={ column.id }>
                    <div class={ ['cell', column.filteredValue && column.filteredValue.length > 0 ? 'highlight' : '', column.labelClassName] }>
                      {
                        column.renderHeader
                          ? column.renderHeader.call(this._renderProxy, h, { column, $index: cellIndex, store: this.store, _self: this.$parent.$vnode.context })
                          : column.label
                      }
                      {
                        column.sortable ? (<span
                          class="caret-wrapper"
                          on-click={ ($event) => this.handleSortClick($event, column) }>
                          <i class="sort-caret ascending"
                            on-click={ ($event) => this.handleSortClick($event, column, 'ascending') }>
                          </i>
                          <i class="sort-caret descending"
                            on-click={ ($event) => this.handleSortClick($event, column, 'descending') }>
                          </i>
                        </span>) : ''
                      }
                      {
                        column.filterable ? (<span
                          class="el-table__column-filter-trigger"
                          on-click={ ($event) => this.handleFilterClick($event, column) }>
                          <i class={ ['el-icon-arrow-down', column.filterOpened ? 'el-icon-arrow-up' : ''] }></i>
                        </span>) : ''
                      }
                    </div>
                  </th>))
                }
                {
                  this.hasGutter ? <th class="gutter"></th> : ''
                }
              </tr>
            )
          }
        </thead>
      </table>
    );
  },

  props: {
    fixed: String,
    store: {
      required: true
    },
    border: Boolean,
    defaultSort: {
      type: Object,
      default() {
        return {
          prop: '',
          order: ''
        };
      }
    }
  },

  components: {
    ElCheckbox
  },

  computed: {
    table() {
      return this.$parent;
    },

    hasGutter() {
      return !this.fixed && this.tableLayout.gutterWidth;
    },

    ...mapStates({
      columns: 'columns',
      isAllSelected: 'isAllSelected',
      leftFixedLeafCount: 'fixedLeafColumnsLength',
      rightFixedLeafCount: 'rightFixedLeafColumnsLength',
      columnsCount: states => states.columns.length,
      leftFixedCount: states => states.fixedColumns.length,
      rightFixedCount: states => states.rightFixedColumns.length,
      dragGhostState: 'dragGhostState'
    })
  },

  created() {
    this.filterPanels = {};
  },

  mounted() {
    // nextTick 是有必要的 https://github.com/ElemeFE/element/pull/11311
    this.$nextTick(() => {
      const { prop, order } = this.defaultSort;
      const init = true;
      this.store.commit('sort', { prop, order, init });
    });
  },

  beforeDestroy() {
    const panels = this.filterPanels;
    for (let prop in panels) {
      if (panels.hasOwnProperty(prop) && panels[prop]) {
        panels[prop].$destroy(true);
      }
    }
  },

  methods: {
    isCellHidden(index, columns) {
      let start = 0;
      for (let i = 0; i < index; i++) {
        start += columns[i].colSpan;
      }
      const after = start + columns[index].colSpan - 1;
      if (this.fixed === true || this.fixed === 'left') {
        return after >= this.leftFixedLeafCount;
      } else if (this.fixed === 'right') {
        return start < this.columnsCount - this.rightFixedLeafCount;
      } else {
        return (after < this.leftFixedLeafCount) || (start >= this.columnsCount - this.rightFixedLeafCount);
      }
    },

    getHeaderRowStyle(rowIndex) {
      const headerRowStyle = this.table.headerRowStyle;
      if (typeof headerRowStyle === 'function') {
        return headerRowStyle.call(null, { rowIndex });
      }
      return headerRowStyle;
    },

    getHeaderRowClass(rowIndex) {
      const classes = [];

      const headerRowClassName = this.table.headerRowClassName;
      if (typeof headerRowClassName === 'string') {
        classes.push(headerRowClassName);
      } else if (typeof headerRowClassName === 'function') {
        classes.push(headerRowClassName.call(null, { rowIndex }));
      }

      return classes.join(' ');
    },

    getHeaderCellStyle(rowIndex, columnIndex, row, column) {
      const headerCellStyle = this.table.headerCellStyle;
      if (typeof headerCellStyle === 'function') {
        return headerCellStyle.call(null, {
          rowIndex,
          columnIndex,
          row,
          column
        });
      }
      return headerCellStyle;
    },

    getHeaderCellClass(rowIndex, columnIndex, row, column) {
      const classes = [column.id, column.order, column.headerAlign, column.className, column.labelClassName];

      if (rowIndex === 0 && this.isCellHidden(columnIndex, row)) {
        classes.push('is-hidden');
      }

      if (!column.children) {
        classes.push('is-leaf');
      }

      if (column.sortable) {
        classes.push('is-sortable');
      }

      if (this.border && column.transposable) {
        classes.push('is-transposable');
      }

      const headerCellClassName = this.table.headerCellClassName;
      if (typeof headerCellClassName === 'string') {
        classes.push(headerCellClassName);
      } else if (typeof headerCellClassName === 'function') {
        classes.push(headerCellClassName.call(null, {
          rowIndex,
          columnIndex,
          row,
          column
        }));
      }

      return classes.join(' ');
    },

    toggleAllSelection(event) {
      event.stopPropagation();
      this.store.commit('toggleAllSelection');
    },

    handleFilterClick(event, column) {
      event.stopPropagation();
      const target = event.target;
      let cell = target.tagName === 'TH' ? target : target.parentNode;
      if (hasClass(cell, 'noclick')) return;
      cell = cell.querySelector('.el-table__column-filter-trigger') || cell;
      const table = this.$parent;

      let filterPanel = this.filterPanels[column.id];

      if (filterPanel && column.filterOpened) {
        filterPanel.showPopper = false;
        return;
      }

      if (!filterPanel) {
        filterPanel = new Vue(FilterPanel);
        this.filterPanels[column.id] = filterPanel;
        if (column.filterPlacement) {
          filterPanel.placement = column.filterPlacement;
        }
        filterPanel.table = table;
        filterPanel.cell = cell;
        filterPanel.column = column;
        !this.$isServer && filterPanel.$mount(document.createElement('div'));
      }

      setTimeout(() => {
        filterPanel.showPopper = true;
      }, 16);
    },

    handleHeaderClick(event, column) {
      if (!column.filters && column.sortable) {
        this.handleSortClick(event, column);
      } else if (column.filterable && !column.sortable) {
        this.handleFilterClick(event, column);
      }

      this.$parent.$emit('header-click', column, event);
    },

    handleHeaderContextMenu(event, column) {
      this.$parent.$emit('header-contextmenu', column, event);
    },

    handleMouseDown(event, column, index) {
      if (this.$isServer) return;
      if (column.children && column.children.length > 0) return;
      /* istanbul ignore if */
      if (this.border && (column.transposable || this.dragGhostState.draggingResize)) {
        this.store.commit('updateDrag', 'dragGhostState', {
          dragging: true
        });
        this.draggingColumn = column;

        const table = this.$parent;
        const columnEl = event.currentTarget;
        const columnRect = columnEl.getBoundingClientRect();

        const pointX = event.clientX;
        const pointY = event.clientY;

        addClass(columnEl, 'noclick');

        document.onselectstart = function() { return false; };
        document.ondragstart = function() { return false; };

        /** 调整列宽的处理 */
        const handelResize = () => {
          table.resizeProxyVisible = true;

          const tableEl = table.$el;
          const tableLeft = tableEl.getBoundingClientRect().left;
          const minLeft = columnRect.left - tableLeft + 30;

          this.dragState = {
            startMouseLeft: pointX,
            startLeft: columnRect.right - tableLeft,
            startColumnLeft: columnRect.left - tableLeft,
            tableLeft
          };

          const resizeProxy = table.$refs.resizeProxy;
          resizeProxy.style.left = this.dragState.startLeft + 'px';

          return {
            handleMouseMove: (event) => {
              const deltaLeft = event.clientX - this.dragState.startMouseLeft;
              const proxyLeft = this.dragState.startLeft + deltaLeft;

              resizeProxy.style.left = Math.max(minLeft, proxyLeft) + 'px';
            },
            currentHandleMouseUp: () => {
              const {
                startColumnLeft,
                startLeft
              } = this.dragState;
              const finalLeft = parseInt(resizeProxy.style.left, 10);
              const columnWidth = finalLeft - startColumnLeft;
              column.width = column.realWidth = columnWidth;
              table.$emit('header-dragend', column.width, startLeft - startColumnLeft, column, event);

              table.resizeProxyVisible = false;
            }
          };
        };

        /** 调整列位置的处理 */
        const handelSort = () => {
          this.store.commit('updateDrag', 'dragGhostState', {
            width: columnRect.width || columnRect.right - columnRect.left,
            height: columnRect.height || columnRect.bottom - columnRect.top,
            top: columnRect.top,
            left: columnRect.left,
            text: column.label,
            offsetX: 0,
            offsetY: 0,
            startEl: columnEl,
            startIndex: index
          });

          return {
            handleMouseMove: (event) => {
              const updateData = {
                offsetX: event.clientX - pointX,
                offsetY: event.clientY - pointY
              };

              if (!this.dragGhostState.ing) {
                document.body.style.cursor = 'move';
                addClass(columnEl, 'table__column-drag-ing');
              }
              updateData.ing = true;

              this.store.commit('updateDrag', 'dragGhostState', updateData);
            },
            currentHandleMouseUp: (event) => {
              removeClass(columnEl, 'table__column-drag-ing');
              removeClass(this.dragGhostState.lastEl, 'table__column-drag-left table__column-drag-right');

              if (this.dragGhostState.startIndex !== this.dragGhostState.lastIndex) {
                let target = event.target;
                // 最多循环 5 次
                let maxMatchTime = 5;
                while (target && target.tagName !== 'TH') {
                  target = target.parentNode;
                  if (maxMatchTime-- < 0) {
                    target = null;
                  }
                }

                if (target && hasClass(target, 'is-transposable')) {
                  // 进行排序，处理复杂（在回调中修改）
                  table.$emit('header-transposed', this.dragGhostState.startIndex, this.dragGhostState.lastIndex, this.columns);
                }
              }

              this.store.commit('updateDrag', 'dragGhostState', {
                ing: false
              });
            }
          };
        };

        const { handleMouseMove, currentHandleMouseUp } = this.dragGhostState.draggingResize ? handelResize() : handelSort();

        const handleMouseUp = (event) => {
          if (this.dragGhostState.dragging) {
            currentHandleMouseUp(event);

            this.store.scheduleLayout();

            document.body.style.cursor = '';
            this.store.commit('updateDrag', 'dragGhostState', {
              dragging: false
            });
            this.draggingColumn = null;
            this.dragState = {};
          }

          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.onselectstart = null;
          document.ondragstart = null;

          setTimeout(function() {
            removeClass(columnEl, 'noclick');
          }, 0);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    },

    handleMouseMove(event, column, index) {
      if (column.children && column.children.length > 0) return;
      const target = event.currentTarget;

      if (!column) return;

      if (this.border) {
        if (column.transposable && !this.dragGhostState.draggingResize && this.dragGhostState.dragging) {
          // 当前为调整列位置
          this.store.commit('updateDrag', 'dragGhostState', {
            lastEl: target,
            lastIndex: index
          });

          if (this.dragGhostState.startIndex > index) {
            addClass(target, 'table__column-drag-left');
          } else if (this.dragGhostState.startIndex < index) {
            addClass(target, 'table__column-drag-right');
          }
        } else if (column.resizable && !this.dragGhostState.dragging) {
          // 用于显示调整列宽的处理
          let rect = target.getBoundingClientRect();

          const bodyStyle = document.body.style;
          if (rect.width > 12 && rect.right - event.pageX < 8) {
            bodyStyle.cursor = 'col-resize';
            if (hasClass(target, 'is-sortable')) {
              target.style.cursor = 'col-resize';
            }
            this.store.commit('updateDrag', 'dragGhostState', {
              draggingResize: true
            });
          } else {
            bodyStyle.cursor = '';
            if (hasClass(target, 'is-sortable')) {
              target.style.cursor = '';
            }
            this.store.commit('updateDrag', 'dragGhostState', {
              draggingResize: false
            });
          }
        }
      }
    },

    handleMouseOut(event) {
      removeClass(event.currentTarget, 'table__column-drag-left table__column-drag-right');
      if (this.$isServer) return;
      document.body.style.cursor = '';
    },

    toggleOrder({ order, sortOrders }) {
      if (order === '') return sortOrders[0];
      const index = sortOrders.indexOf(order || null);
      return sortOrders[index > sortOrders.length - 2 ? 0 : index + 1];
    },

    handleSortClick(event, column, givenOrder) {
      event.stopPropagation();
      let order = column.order === givenOrder
        ? null
        : (givenOrder || this.toggleOrder(column));

      let target = event.target;
      while (target && target.tagName !== 'TH') {
        target = target.parentNode;
      }

      if (target && target.tagName === 'TH') {
        if (hasClass(target, 'noclick')) {
          removeClass(target, 'noclick');
          return;
        }
      }

      if (!column.sortable) return;

      const states = this.store.states;
      let sortProp = states.sortProp;
      let sortOrder;
      const sortingColumn = states.sortingColumn;

      if (sortingColumn !== column || (sortingColumn === column && sortingColumn.order === null)) {
        if (sortingColumn) {
          sortingColumn.order = null;
        }
        states.sortingColumn = column;
        sortProp = column.property;
      }

      if (!order) {
        sortOrder = column.order = null;
      } else {
        sortOrder = column.order = order;
      }

      states.sortProp = sortProp;
      states.sortOrder = sortOrder;

      this.store.commit('changeSortCondition');
    }
  },

  data() {
    return {
      draggingColumn: null,
      dragState: {}
    };
  }
};
