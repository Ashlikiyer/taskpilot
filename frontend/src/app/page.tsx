import {
  BoardsSection,
  CaptureSection,
  Faq,
  Pricing,
} from "@/components/landing/landing-interactive";
import {
  CallToAction,
  FeatureGrid,
  Hero,
  LandingFooter,
  LandingNav,
  TeamSection,
} from "@/components/landing/landing-sections";

export default function Home() {
  return (
    <div className="flex w-full flex-1 flex-col overflow-x-hidden bg-white text-[#15171a]">
      <LandingNav />
      <main>
        <Hero />
        <CaptureSection />
        <TeamSection />
        <BoardsSection />
        <FeatureGrid />
        <Pricing />
        <Faq />
        <CallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
