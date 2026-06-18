import type { Metadata } from "next";
import { HomePage } from "@/app/_components/home-page";

export const metadata: Metadata = {
  title: "Wine Envelope",
  description: "와인 정보 탐색과 개인 테이스팅 노트를 분리해서 관리하는 앱",
};

export default function Page() {
  return <HomePage />;
}
