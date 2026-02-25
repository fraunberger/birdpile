import { notFound } from "next/navigation";
import { BlackjackTrainer } from "@/components/blackjack-trainer/BlackjackTrainer";
import { BillSplitter } from "@/components/bill-splitter/BillSplitter";
import { RestaurantVotingApp } from "@/components/pileated-woodpecker-election/RestaurantVotingApp";
import Link from "next/link";
import Image from "next/image";

export default async function BirdAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const isBillSplitter = slug === "australian_magpie";
  const isBlackjack = slug === "eastern_bluebird" || slug === "eastern_blue_bird";
  const isElection = slug === "pileated_woodpecker" || slug === "pileated-woodpecker";

  if (isBillSplitter) {
    return (
      <div className="min-h-screen bg-white font-mono text-black p-4">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity group">
          <span className="text-xl group-hover:-translate-x-1 transition-transform">&larr;</span>
          <div className="relative w-12 h-8">
            <Image src="/logo.png" alt="Apps" fill className="object-contain" />
          </div>
        </Link>
        <BillSplitter />
      </div>
    );
  }

  if (isBlackjack) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-black p-4 flex flex-col items-center">
        <Link href="/" className="self-start inline-flex items-center gap-2 mb-8 hover:opacity-70 transition-opacity group">
          <span className="text-xl group-hover:-translate-x-1 transition-transform">&larr;</span>
          <div className="relative w-12 h-8">
            <Image src="/logo.png" alt="Apps" fill className="object-contain" />
          </div>
        </Link>
        <BlackjackTrainer />
      </div>
    );
  }

  if (isElection) {
    return <RestaurantVotingApp />;
  }

  notFound();
}
