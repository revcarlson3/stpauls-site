"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

const buttonClass = "focus-ring rounded border border-ink/15 px-2 py-1 text-xs font-semibold hover:bg-mist";

export default function SimpleRichTextEditor({ value, onChange, label = "Biography" }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current && editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  function command(commandName: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(commandName, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Enter a URL");
    if (!url) return;
    command("createLink", url.trim());
  }

  return <div className="grid gap-2">
    <span className="text-sm font-semibold">{label}</span>
    <div className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-ink/15 bg-mist/40 p-2" role="toolbar" aria-label={`${label} formatting`}>
      <button type="button" className={buttonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} aria-label="Bold"><strong>B</strong></button>
      <button type="button" className={buttonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} aria-label="Italic"><em>I</em></button>
      <button type="button" className={buttonClass} onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")} aria-label="Underline"><u>U</u></button>
      <button type="button" className={buttonClass} onMouseDown={(event) => event.preventDefault()} onClick={addLink} aria-label="Insert URL">URL</button>
      <label className="flex items-center gap-1 text-xs font-semibold">Size<select aria-label="Font size" className="rounded border border-ink/15 bg-white px-1 py-1 font-normal" defaultValue="3" onChange={(event) => command("fontSize", event.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="5">Large</option><option value="7">Extra large</option></select></label>
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} className="focus-ring min-h-32 rounded-b-lg border border-ink/15 p-3 text-sm leading-6 outline-none" onFocus={() => { focusedRef.current = true; }} onBlur={() => { focusedRef.current = false; }} onInput={(event) => onChange(event.currentTarget.innerHTML)} />
    <span className="text-xs font-normal text-ink/55">Basic formatting only: bold, italic, underline, links, and font size.</span>
  </div>;
}
