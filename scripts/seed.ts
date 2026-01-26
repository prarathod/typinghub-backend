import "dotenv/config";

import mongoose from "mongoose";

import { connectMongo } from "../src/config/db";
import Paragraph from "../src/models/Paragraph";

type Category = "lessons" | "court-exam" | "mpsc";

const ENGLISH_PARAGRAPHS: Array<{
  title: string;
  description: string;
  difficulty: "easy" | "intermediate" | "hard";
  isFree: boolean;
  language: "english";
  category: Category;
  solvedCount: number;
  text: string;
}> = [
  {
    title: "The Quick Brown Fox",
    description: "Classic pangram for warming up. Good for beginners.",
    difficulty: "easy",
    isFree: true,
    language: "english",
    category: "lessons",
    solvedCount: 124,
    text: "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!"
  },
  {
    title: "Government Exam Basics",
    description: "Short passage on Indian governance. Useful for SSC typing tests.",
    difficulty: "easy",
    isFree: true,
    language: "english",
    category: "court-exam",
    solvedCount: 89,
    text: "India is a sovereign, socialist, secular, democratic republic. The Constitution of India is the supreme law of the land. The President is the head of state and the Prime Minister is the head of government."
  },
  {
    title: "Maharashtra State GK",
    description: "Facts about Maharashtra. Relevant for state-level exams.",
    difficulty: "intermediate",
    isFree: true,
    language: "english",
    category: "lessons",
    solvedCount: 56,
    text: "Maharashtra is the second-most populous state in India. Mumbai is its capital and financial hub. The state has a rich cultural heritage and is known for the Marathi language, Bollywood, and historical sites like the Ajanta and Ellora caves."
  },
  {
    title: "Current Affairs Summary",
    description: "Recent events and policies. Helps with descriptive typing.",
    difficulty: "intermediate",
    isFree: false,
    language: "english",
    category: "mpsc",
    solvedCount: 34,
    text: "Digital India aims to transform the country into a digitally empowered society. The initiative focuses on digital infrastructure, digital literacy, and digital delivery of services. Several schemes have been launched to promote cashless transactions and e-governance."
  },
  {
    title: "Economic Development",
    description: "Concepts in Indian economy. For competitive exam preparation.",
    difficulty: "intermediate",
    isFree: true,
    language: "english",
    category: "mpsc",
    solvedCount: 72,
    text: "The Indian economy has shown resilience despite global challenges. Agriculture, manufacturing, and services are the three major sectors. The government has introduced various reforms to boost growth, including GST and initiatives for ease of doing business."
  },
  {
    title: "Advanced Comprehension",
    description: "Longer passage with complex sentences. For experienced typists.",
    difficulty: "hard",
    isFree: false,
    language: "english",
    category: "mpsc",
    solvedCount: 18,
    text: "The implementation of sustainable development goals requires coordinated efforts between the central and state governments. Policies must address environmental degradation, inequality, and access to quality education and healthcare. Stakeholder participation and transparent governance are essential for long-term success."
  },
  {
    title: "Paragraph Practice One",
    description: "Simple sentences for daily practice. Ideal for building speed.",
    difficulty: "easy",
    isFree: true,
    language: "english",
    category: "lessons",
    solvedCount: 210,
    text: "Practice makes perfect. Type regularly to improve your speed and accuracy. Start with easy passages and gradually move to difficult ones. Consistency is the key to success in typing exams."
  },
  {
    title: "Paragraph Practice Two",
    description: "Mixed difficulty sentences. Tests consistency.",
    difficulty: "intermediate",
    isFree: true,
    language: "english",
    category: "lessons",
    solvedCount: 95,
    text: "Typing skills are essential for government job aspirants. Many examinations include a typing test as part of the selection process. Candidates must achieve a minimum words-per-minute score to qualify. Regular practice with relevant content can significantly improve performance."
  },
  {
    title: "Premium Passage",
    description: "Expert-level passage. Paid content for advanced learners.",
    difficulty: "hard",
    isFree: false,
    language: "english",
    category: "court-exam",
    solvedCount: 12,
    text: "The judiciary plays a pivotal role in upholding the rule of law and protecting the fundamental rights of citizens. Judicial independence ensures that courts can act without fear or favour. The Constitution provides for a unified judiciary with the Supreme Court at the apex, followed by High Courts and subordinate courts across the states and union territories."
  }
];

async function seed() {
  try {
    await connectMongo();

    const updated = await Paragraph.updateMany(
      { category: { $exists: false } },
      { $set: { category: "lessons" } }
    );
    if (updated.modifiedCount > 0) {
      console.log(`Migrated ${updated.modifiedCount} paragraphs with default category 'lessons'.`);
    }

    const COURT_EXAM_TITLES = ["Government Exam Basics", "Premium Passage"];
    const MPSC_TITLES = ["Current Affairs Summary", "Economic Development", "Advanced Comprehension"];
    for (const title of COURT_EXAM_TITLES) {
      await Paragraph.updateMany({ title }, { $set: { category: "court-exam" } });
    }
    for (const title of MPSC_TITLES) {
      await Paragraph.updateMany({ title }, { $set: { category: "mpsc" } });
    }

    const existing = await Paragraph.countDocuments({ language: "english" });
    if (existing > 0) {
      console.log(`Found ${existing} existing English paragraphs. Skipping seed.`);
      process.exit(0);
      return;
    }
    await Paragraph.insertMany(ENGLISH_PARAGRAPHS);
    console.log(`Inserted ${ENGLISH_PARAGRAPHS.length} English paragraphs.`);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

seed();
