import { useEffect, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Color from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import { FontSize, TextStyle } from "@tiptap/extension-text-style"
import { isSafeHttpUrl, sanitizeRichTextHtml } from "../../utils/postContent.js"
import "./richTextEditor.css"

const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 32
const FONT_SIZE_STEP = 2
const HIGHLIGHT_COLORS = [
  { label: "Yellow highlight", value: "#fff2a8" },
  { label: "Green highlight", value: "#d8f3dc" },
  { label: "Blue highlight", value: "#cfe8ff" },
  { label: "Pink highlight", value: "#fce1e4" },
]
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function textToDocument(value) {
  const lines = String(value || "").split(/\r\n?|\n/)
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  }
}

function getPlainText(editor) {
  return editor.getText({ blockSeparator: "\n" })
}

function getSelectionMarks(state, markName) {
  const { selection, doc } = state
  const markType = state.schema.marks[markName]
  if (!markType) return []

  if (selection.empty) {
    return (state.storedMarks || selection.$from.marks())
      .filter((mark) => mark.type.name === markName)
  }

  const marks = []
  doc.descendants((node, position) => {
    if (
      node.isText
      && position < selection.to
      && position + node.nodeSize > selection.from
    ) {
      node.marks.forEach((mark) => {
        if (mark.type.name === markName) marks.push(mark)
      })
    }
  })
  return marks
}

function isMarkActive(state, markName, attributes = {}) {
  const { selection, doc, schema } = state
  if (!selection.empty && Object.keys(attributes).length === 0) {
    return doc.rangeHasMark(selection.from, selection.to, schema.marks[markName])
  }

  return getSelectionMarks(state, markName).some((mark) =>
    Object.entries(attributes).every(([key, value]) => mark.attrs[key] === value)
  )
}

function getMarkAttribute(state, markName, attribute) {
  return getSelectionMarks(state, markName)[0]?.attrs[attribute]
}

function getActiveNode(state, nodeName) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === nodeName) return node
  }
  return null
}

function isNodeActive(state, nodeName, attributes = {}) {
  const { selection, doc } = state
  const matches = (node) =>
    node.type.name === nodeName
    && Object.entries(attributes).every(([key, value]) => node.attrs[key] === value)

  if (selection.empty) {
    for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
      if (matches(selection.$from.node(depth))) return true
    }
    return false
  }

  let active = false
  doc.descendants((node, position) => {
    if (
      position < selection.to
      && position + node.nodeSize > selection.from
      && matches(node)
    ) active = true
  })
  return active
}

function RichTextEditor({ value, htmlValue = "", onChange, placeholder, maxLength = 2200 }) {
  const onChangeRef = useRef(onChange)
  const lastValidDocumentRef = useRef(textToDocument(value))
  const lastTextRef = useRef(String(value || ""))
  const lastHtmlValueRef = useRef(String(htmlValue || ""))
  const linkInputRef = useRef(null)
  const [, setToolbarVersion] = useState(0)
  const [linkError, setLinkError] = useState("")
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (linkEditorOpen) linkInputRef.current?.focus()
  }, [linkEditorOpen])

  const refreshToolbar = () => {
    window.requestAnimationFrame(() => {
      setToolbarVersion((version) => version + 1)
    })
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
        protocols: ["http", "https"],
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
        isAllowedUri: (url) => isSafeHttpUrl(url),
      }),
    ],
    content: textToDocument(value),
    editorProps: {
      attributes: {
        class: "rte-content",
        "aria-label": "Post caption editor",
      },
      transformPastedHTML: sanitizeRichTextHtml,
    },
    onCreate: ({ editor: currentEditor }) => {
      lastValidDocumentRef.current = currentEditor.getJSON()
      lastTextRef.current = getPlainText(currentEditor)
    },
    onUpdate: ({ editor: currentEditor }) => {
      const text = getPlainText(currentEditor)
      if (text.length > maxLength) {
        currentEditor.commands.setContent(lastValidDocumentRef.current, { emitUpdate: false })
        return
      }

      lastValidDocumentRef.current = currentEditor.getJSON()
      lastTextRef.current = text
      onChangeRef.current(text, currentEditor.getHTML())
    },
    onSelectionUpdate: refreshToolbar,
    onTransaction: refreshToolbar,
  }, [])

  useEffect(() => {
    if (!editor) return

    const text = String(value || "")
    const html = String(htmlValue || "")
    if (html !== lastHtmlValueRef.current) {
      lastHtmlValueRef.current = html
      const content = html ? sanitizeRichTextHtml(html) : ""
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content || textToDocument(text), { emitUpdate: false })
      }
      const updatedText = getPlainText(editor)
      lastTextRef.current = updatedText
      lastValidDocumentRef.current = editor.getJSON()
      if (updatedText !== text) onChangeRef.current(updatedText, editor.getHTML())
      return
    }

    if (text !== getPlainText(editor)) {
      editor.commands.setContent(textToDocument(text), { emitUpdate: false })
    }
    lastTextRef.current = getPlainText(editor)
    lastValidDocumentRef.current = editor.getJSON()
  }, [editor, value, htmlValue])

  if (!editor) return null

  const editorState = editor.state

  const runToolbarCommand = (event, command) => {
    event.preventDefault()
    command()
  }

  const toolbarButton = (label, icon, active, disabled, command) => (
    <button
      key={label}
      type="button"
      className={`rte-button${active ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => runToolbarCommand(event, command)}
    >
      {icon}
    </button>
  )

  const currentFontSize = Number.parseInt(getMarkAttribute(editorState, "textStyle", "fontSize"), 10) || 12
  const currentColor = getMarkAttribute(editorState, "textStyle", "color")
  const textColor = HEX_COLOR_PATTERN.test(currentColor || "") ? currentColor : "#111111"
  const heading = getActiveNode(editorState, "heading")
  const selectedBlock = heading ? `h${heading.attrs.level}` : "paragraph"

  const openLinkEditor = () => {
    setLinkUrl(editor.getAttributes("link").href || "")
    setLinkError("")
    setLinkEditorOpen(true)
  }

  const applyLink = (event) => {
    event.preventDefault()
    const url = linkUrl.trim()
    if (!isSafeHttpUrl(url)) {
      setLinkError("Enter a valid http:// or https:// URL without embedded credentials.")
      return
    }

    setLinkError("")
    editor.chain().focus().setLink({
      href: new URL(url).href,
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }).run()
    setLinkEditorOpen(false)
  }

  const alignmentButton = (alignment, label, icon) => {
    return toolbarButton(
      label,
      icon,
      isNodeActive(editorState, "paragraph", { textAlign: alignment })
        || isNodeActive(editorState, "heading", { textAlign: alignment }),
      false,
      () => editor.chain().focus().setTextAlign(alignment).run()
    )
  }

  return (
    <div className="rte-editor">
      <div className="rte-toolbar" role="toolbar" aria-label="Text formatting">
        <div className="rte-toolbar-group" role="group" aria-label="Block style">
          <select
            aria-label="Paragraph style"
            title="Paragraph style"
            value={selectedBlock}
            onChange={(event) => {
              const style = event.target.value
              const chain = editor.chain().focus()
              if (style === "paragraph") chain.setParagraph().run()
              else chain.setHeading({ level: Number(style.slice(1)) }).run()
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Text styles">
          {toolbarButton("Bold", <b>B</b>, isMarkActive(editorState, "bold"), false, () => editor.chain().focus().toggleBold().run())}
          {toolbarButton("Italic", <i>I</i>, isMarkActive(editorState, "italic"), false, () => editor.chain().focus().toggleItalic().run())}
          {toolbarButton("Underline", <u>U</u>, isMarkActive(editorState, "underline"), false, () => editor.chain().focus().toggleUnderline().run())}
          {toolbarButton("Strikethrough", <s>S</s>, isMarkActive(editorState, "strike"), false, () => editor.chain().focus().toggleStrike().run())}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Font size">
          {toolbarButton(
            "Decrease font size",
            "A−",
            false,
            currentFontSize <= MIN_FONT_SIZE,
            () => editor.chain().focus().setFontSize(`${Math.max(MIN_FONT_SIZE, currentFontSize - FONT_SIZE_STEP)}px`).run()
          )}
          <output className="rte-font-size" aria-label={`Current font size ${currentFontSize} pixels`}>
            {currentFontSize}px
          </output>
          {toolbarButton(
            "Increase font size",
            "A+",
            false,
            currentFontSize >= MAX_FONT_SIZE,
            () => editor.chain().focus().setFontSize(`${Math.min(MAX_FONT_SIZE, currentFontSize + FONT_SIZE_STEP)}px`).run()
          )}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Text alignment">
          {alignmentButton("left", "Align left", "≡")}
          {alignmentButton("center", "Align center", "☰")}
          {alignmentButton("right", "Align right", "≡")}
          {alignmentButton("justify", "Justify", "☷")}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Lists">
          {toolbarButton(
            "Bulleted list",
            "• ≡",
            isNodeActive(editorState, "bulletList"),
            false,
            () => editor.chain().focus().toggleBulletList().run()
          )}
          {toolbarButton(
            "Numbered list",
            "1. ≡",
            isNodeActive(editorState, "orderedList"),
            false,
            () => editor.chain().focus().toggleOrderedList().run()
          )}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Colors">
          {HIGHLIGHT_COLORS.map(({ label, value: color }) => toolbarButton(
            label,
            <span className="rte-color-swatch" style={{ backgroundColor: color }} />,
            isMarkActive(editorState, "highlight", { color }),
            false,
            () => editor.chain().focus().setHighlight({ color }).run()
          ))}
          {toolbarButton(
            "Remove highlight",
            "×",
            false,
            !isMarkActive(editorState, "highlight"),
            () => editor.chain().focus().unsetHighlight().run()
          )}
          <label className="rte-text-color" title="Text color">
            <span aria-hidden="true">A</span>
            <input
              type="color"
              aria-label="Text color"
              value={textColor}
              onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            />
          </label>
          {toolbarButton(
            "Remove text color",
            "A×",
            false,
            !currentColor,
            () => editor.chain().focus().unsetColor().run()
          )}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Links">
          {toolbarButton(
            isMarkActive(editorState, "link") ? "Edit link" : "Add link",
            "↗",
            isMarkActive(editorState, "link"),
            false,
            openLinkEditor
          )}
          {toolbarButton(
            "Remove link",
            "⛓×",
            false,
            !isMarkActive(editorState, "link"),
            () => {
              setLinkEditorOpen(false)
              setLinkError("")
              editor.chain().focus().unsetLink().run()
            }
          )}
        </div>
        <span className="rte-separator" aria-hidden="true" />
        <div className="rte-toolbar-group" role="group" aria-label="Editing">
          {toolbarButton(
            "Undo",
            "↶",
            false,
            !editor.can().chain().focus().undo().run(),
            () => editor.chain().focus().undo().run()
          )}
          {toolbarButton(
            "Redo",
            "↷",
            false,
            !editor.can().chain().focus().redo().run(),
            () => editor.chain().focus().redo().run()
          )}
          {toolbarButton(
            "Clear formatting",
            "Tx",
            false,
            false,
            () => editor.chain().focus().unsetAllMarks().clearNodes().run()
          )}
        </div>
        {linkEditorOpen && (
          <form
            className="rte-link-form"
            role="group"
            aria-label="Link settings"
            onSubmit={applyLink}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLinkEditorOpen(false)
                setLinkError("")
                editor.commands.focus()
              }
            }}
          >
            <label htmlFor="rte-link-url">Link URL</label>
            <input
              ref={linkInputRef}
              id="rte-link-url"
              type="url"
              value={linkUrl}
              placeholder="https://example.com"
              onChange={(event) => setLinkUrl(event.target.value)}
              aria-invalid={Boolean(linkError)}
              aria-describedby={linkError ? "rte-link-error" : undefined}
            />
            <button type="submit" className="rte-link-apply">Apply</button>
            <button
              type="button"
              className="rte-link-cancel"
              onClick={() => {
                setLinkEditorOpen(false)
                setLinkError("")
                editor.commands.focus()
              }}
            >
              Cancel
            </button>
            {linkError && <span id="rte-link-error" className="rte-link-error" role="alert">{linkError}</span>}
          </form>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
