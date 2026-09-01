import { FilmApp } from "@/components/FilmApp";
import { FilmProvider } from "@/lib/film-store";

export default function Home() {
  return (
    <FilmProvider>
      <FilmApp />
    </FilmProvider>
  );
}
