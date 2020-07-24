import { Node } from '../base';

// NOTE: this node cannot be generated in WYSIWYG mode
export default class BoldBlock extends Node {
  get name() {
    return 'bold_block';
  }

  get schema() {
    return {
      attrs: {},
      content: 'block+',
      group: 'block',
      draggable: false,
      parseDOM: [{
        tag: 'div.bold'
      }],
      toDOM: ['div', { class: 'bold' }, 0]
    };
  }

  get markdownParserToken() {
    return {
      block: this.name,
      getAttrs: token => token.serializeAttributes()
    };
  }

  markdownSerialize(state, node) {
    state.renderBlock(node, 'bold');
  }
}