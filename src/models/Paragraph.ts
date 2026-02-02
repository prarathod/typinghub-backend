import mongoose, { Schema, type HydratedDocument } from "mongoose";

export type Language = "english" | "marathi";
export type Category = "lessons" | "court-exam" | "mpsc";

export type IParagraph = {
  title: string;
  isFree: boolean;
  language: Language;
  category: Category;
  order: number;
  solvedCount: number;
  text: string;
  published: boolean;
  createdAt: Date;
};

export type ParagraphDocument = HydratedDocument<IParagraph>;

const paragraphSchema = new Schema<IParagraph>({
  title: { type: String, required: true },
  isFree: { type: Boolean, required: true, default: true },
  language: {
    type: String,
    required: true,
    enum: ["english", "marathi"]
  },
  category: {
    type: String,
    required: true,
    enum: ["lessons", "court-exam", "mpsc"]
  },
  order: { type: Number, default: 0 },
  solvedCount: { type: Number, default: 0 },
  text: { type: String, required: true },
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Paragraph = mongoose.model<IParagraph>("Paragraph", paragraphSchema);

export default Paragraph;
