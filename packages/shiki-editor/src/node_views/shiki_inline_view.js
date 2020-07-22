import { bind } from 'decko';
import DOMView from './dom_view';
import { getShikiLoader } from '../utils';

export default class ShikiInlineView extends DOMView {
  constructor(options) {
    super(options);

    this.dom = document.createElement('span');

    this.dom.classList.add('b-shiki_editor-node');

    if (this.node.attrs.isLoading) {
      this.dom.classList.add('b-ajax');
      this.dom.classList.add('vk-like');
    }
    if (this.node.attrs.isError) {
      this.dom.classList.add('is-error');
    }

    this.dom.innerText = this.node.attrs.bbcode;
    this.dom.addEventListener('click', this.stop);

    this.fetch();
  }

  get type() {
    return this.node.attrs.type;
  }

  @bind
  stop() {
    this.replaceWith(
      this.view.state.schema.text(this.node.attrs.bbcode)
    );
  }

  get shikiLoader() {
    return getShikiLoader(this.editor);
  }

  async fetch() {
    const result = await this.shikiLoader.fetch(this.node.attrs);
    if (this.isDestroyed) { return; }

    if (result) {
      this.success(result);
    } else {
      this.error();
    }
  }

  success(result) {
    if (this.type === 'poster' || this.type === 'image') {
      this.replaceWith(
        this.editor.schema.nodes.image.create({
          id: result.id,
          src: result.url,
          isPoster: this.type === 'poster'
        }),
        false
      );
    }
  }

  error() {
    const { getPos, view, dispatch, tr } = this;
    const attrs = this.mergeAttrs({ isLoading: false, isError: true });

    dispatch(
      tr
        .setMeta('addToHistory', false)
        .setNodeMarkup(getPos(), null, attrs)
    );
    view.focus();
  }
}