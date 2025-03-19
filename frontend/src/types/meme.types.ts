export interface MemeTemplate {
  id: string;
  url: string;
  name: string;
  type?: "image" | "video"; // Optional field to specify media type
}

export interface MemeResponse {
  type: "meme";
  templateId: string;
  topText: string;
  bottomText: string;
}

export interface TextResponse {
  type: "text";
  text: string;
}

export type GameResponse = MemeResponse | TextResponse;
