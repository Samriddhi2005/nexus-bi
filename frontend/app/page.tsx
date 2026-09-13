import CTA from "@/components/landing/CTA";
import GridPlane from "@/components/landing/GridPlane";
import Guardrail from "@/components/landing/Guardrail";
import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import NeuralField from "@/components/landing/NeuralField";
import PipelineRail from "@/components/landing/PipelineRail";
import Stakes from "@/components/landing/Stakes";
import Surfaces from "@/components/landing/Surfaces";
import TheRun from "@/components/landing/TheRun";

export default function Home() {
  return (
    <div className="landing relative min-h-screen w-full overflow-x-clip">
      <NeuralField />
      <GridPlane />
      <PipelineRail />
      <Nav />

      <main className="relative">
        <Hero />
        <Stakes />
        <TheRun />
        <Guardrail />
        <Surfaces />
        <CTA />
      </main>
    </div>
  );
}
