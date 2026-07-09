type OpenAITextContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAITextContent[];
};

type OpenAIResponseShape = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

export function extractOpenAIText(payload: OpenAIResponseShape) {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .find((text) => text.trim()) ?? ""
  ).trim();
}
