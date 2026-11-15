import { Features } from '@/components/landing/Features';
import { Finale } from '@/components/landing/Finale';
import { ForestFooter } from '@/components/landing/ForestFooter';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingNav } from '@/components/landing/LandingNav';
import { Questions } from '@/components/landing/Questions';
import { Roles } from '@/components/landing/Roles';
import { Why } from '@/components/landing/Why';

export default function LandingPage() {
  return (
    <>
      <div className="wrap pt-3">
        <LandingNav />
        <main id="main" tabIndex={-1}>
          <Hero />
          <Why />
          <Features />
          <HowItWorks />
          <Roles />
          <Questions />
          <Finale />
        </main>
      </div>
      <ForestFooter />
    </>
  );
}
