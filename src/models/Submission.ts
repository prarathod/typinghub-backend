import mongoose, { Schema, type HydratedDocument } from "mongoose";

export type ISubmission = {
  paragraphId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  timeTakenSeconds: number;
  accuracy: number;
  totalKeystrokes: number;
  backspaceCount: number;
  wordsTyped: number;
  wpm: number;
  kpm: number;
  incorrectWordsCount: number;
  incorrectWords: string[];
  correctWordsCount: number;
  userInput: string;
  /** Optional: for genuine-candidate ranking (completion ratio, score). */
  omittedWordsCount?: number;
  totalPassageWords?: number;
  /** Score = (completionRatio²) × (accuracy/100) × wpm. Set when submission is genuine (R ≥ 0.9, accuracy ≥ 50). */
  rankingScore?: number;
  createdAt: Date;
};

export type SubmissionDocument = HydratedDocument<ISubmission>;

const submissionSchema = new Schema<ISubmission>({
  paragraphId: { type: Schema.Types.ObjectId, ref: "Paragraph", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  timeTakenSeconds: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  totalKeystrokes: { type: Number, required: true },
  backspaceCount: { type: Number, required: true },
  wordsTyped: { type: Number, required: true },
  wpm: { type: Number, required: true },
  kpm: { type: Number, required: true },
  incorrectWordsCount: { type: Number, required: true },
  incorrectWords: { type: [String], default: [] },
  correctWordsCount: { type: Number, required: true },
  userInput: { type: String, required: true },
  omittedWordsCount: { type: Number },
  totalPassageWords: { type: Number },
  rankingScore: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const Submission = mongoose.model<ISubmission>("Submission", submissionSchema);

export default Submission;
