function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlock: string[] = [];

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      html.push(`<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>`);
      codeBlock = [];
      inCodeBlock = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) closeCodeBlock();
      else {
        closeList();
        inCodeBlock = true;
        codeBlock = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlock.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.trimStart().startsWith("<")) {
      closeList();
      if (typeof window !== "undefined") {
        html.push(line);
      } else {
        html.push(`<p>${escapeHtml(line)}</p>`);
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1]?.length ?? 3;
      html.push(`<h${level}>${formatInline(headingMatch[2] ?? "")}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${formatInline(listMatch[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  }

  closeList();
  closeCodeBlock();
  return html.join("");
}

export function dumprify(markdown: string) {
  return markdownToHtml(markdown);
}
