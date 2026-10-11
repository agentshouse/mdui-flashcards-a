import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';

// Text formatting stays local. Markdown cannot embed network resources or active HTML.
// The donor canvas is light; do not let OS dark mode select pale Markdown text.
const schema = {...defaultSchema, tagNames: defaultSchema.tagNames?.filter(name => !['img', 'iframe', 'video', 'audio', 'source', 'script', 'style', 'input'].includes(name)), attributes: {...defaultSchema.attributes, a: ['title']}};
// eslint-disable-next-line react-refresh/only-export-components
export const safePreview = {rehypePlugins: [[rehypeSanitize, schema]], disableCopy: true, skipHtml: true, wrapperElement: {'data-color-mode': 'light'}} satisfies NonNullable<React.ComponentProps<typeof MDEditor>['previewOptions']>;
export function SafeMarkdown({source}: {source: string}) {return <MDEditor.Markdown source={source} {...safePreview}/>;}
