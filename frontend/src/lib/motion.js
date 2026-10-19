export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

export const snappy = { stiffness: 420, damping: 30, mass: 0.7 }
export const soft = { stiffness: 220, damping: 28, mass: 0.9 }

export const slideUp = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { type: 'spring', ...soft } },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
}

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}
