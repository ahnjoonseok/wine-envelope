import type { Metadata } from "next";
import { DiscoverPage } from "@/app/_components/discover-page";

export const metadata: Metadata = {
  title: "와인 찾기 | Wine Envelope",
  description: "분리된 와인 정보 데이터베이스에서 와인을 검색해보세요.",
};

export default function Page() {
  return <DiscoverPage />;
}
