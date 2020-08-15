import { getShikiLoader } from '../utils';

export default function insertUserMention({ range, attrs, schema, editor }) {
  return (state, dispatch, _view) => {
    const replacement = schema.text(
      attrs.text,
      [
        markLinkInline(schema, attrs)
      ]
    );

    dispatch(state.tr.replaceWith(range.from, range.to, replacement));
    getShikiLoader(editor).addToCache('user', attrs.id, attrs);
  };
}

function markLinkInline(schema, attrs) {
  return schema.marks.link_inline.create({
    ...attrs,
    type: 'user',
    meta: { isMention: true }
  }, null, []);
}
