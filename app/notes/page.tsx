import type { Metadata } from "next";
import { NotesPage } from "@/app/_components/notes-page";

export const metadata: Metadata = {
  title: "내 노트 | Wine Envelope",
  description: "내 와인 테이스팅 노트를 따로 저장하고 관리해보세요.",
};

export default function Page() {
  return <NotesPage />;
}
