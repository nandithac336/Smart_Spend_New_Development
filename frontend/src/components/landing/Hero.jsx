import { ArrowDown, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import ProductPreview from './PhoneMockup.jsx'

export default function Hero({ authenticated }) {
  const motionDisabled = useMotionDisabled()
  const destination = authenticated ? '/dashboard' : '/register'

  return (
    <section className="landing-hero">
      {!motionDisabled && <div aria-hidden="true" className="landing-hero-glow" />}
      <div className="landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><Sparkles aria-hidden="true" /> Your money, in focus</p>
          <h1>
            <span className="landing-title-line">Make every rupee</span>{' '}
            <span className="landing-title-line landing-title-line-accent">make sense.</span>
          </h1>
          <p className="landing-hero-description">
            Track income, spending, and wallets in one clear view. Spend with more confidence, one day at a time.
          </p>
          <div className="landing-hero-actions">
            <Button asChild className="landing-primary-cta" size="lg">
              <Link to={destination}>
                {authenticated ? 'Open dashboard' : 'Get started free'}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {!authenticated && (
              <Button asChild className="landing-login-cta" size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            )}
          </div>
          <p className="landing-hero-note"><ShieldCheck aria-hidden="true" /> Your financial records are tied to your account.</p>
          <a className="landing-scroll-cue" href="#features">
            Explore SmartSpend <ArrowDown aria-hidden="true" />
          </a>
        </div>
        <div className="landing-preview-wrap">
          <ProductPreview />
        </div>
      </div>
    </section>
  )
}
