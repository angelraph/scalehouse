import Link from "next/link";
import { Mark } from "@/components/Mark";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <Mark size={72} />
      <p className="eyebrow mt-8">404</p>
      <h1 className="display mt-3 text-5xl">Nothing weighed here.</h1>
      <p className="mt-4 text-muted">This page, ticket or house doesn&apos;t exist. If you followed a ticket link, check the number.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/board" className="btn">
          Go to the board
        </Link>
        <Link href="/" className="btn btn-quiet">
          Home
        </Link>
      </div>
    </div>
  );
}
