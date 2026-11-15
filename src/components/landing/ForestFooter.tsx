import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';

export function ForestFooter() {
  return (
    <footer className="forest mt-24 overflow-hidden pt-16">
      <div className="wrap grid gap-8 sm:grid-cols-[2fr_1fr]">
        <p className="muted-on-dark max-w-[36rem]">
          {APP_NAME} helps a family keep track together. It is not a medical device and gives no medical advice. Always
          check with your doctor or pharmacist.
        </p>
        <ul className="grid content-start gap-1">
          <li>
            <Link href="/create" className="link inline-flex min-h-12 items-center">
              Create a circle
            </Link>
          </li>
          <li>
            <Link href="/join" className="link inline-flex min-h-12 items-center">
              Join a circle
            </Link>
          </li>
          <li>
            <a href="https://github.com/SKrafiqh/kinkeep" className="link inline-flex min-h-12 items-center">
              Source code
            </a>
          </li>
        </ul>
      </div>
      <p className="wordmark mt-14 pb-4" aria-hidden>
        {APP_NAME}
      </p>
    </footer>
  );
}
