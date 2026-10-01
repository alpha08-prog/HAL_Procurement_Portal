// Prose ↔ HTML helpers shared by the noting routes and the summariser. AI notes arrive as
// plain prose (paragraphs separated by blank lines) and are stored twice: as HTML in
// notes.body for the editor, and verbatim in notes.body_text for NoteRenderer and the
// summariser, which must never see markup.
export const proseToHtml = (text) => {
  if (!text) return '<p></p>';
  return String(text)
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
};

export const htmlToText = (html) => String(html ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, '\n')
  .trim();
