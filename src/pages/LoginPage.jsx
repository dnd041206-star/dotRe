import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <h1 className="font-galmuri9 text-[40px] text-ink">
        Dot-Re
      </h1>

      <button
        onClick={signInWithGoogle}
        className="rounded-full border-2 border-line bg-white px-6 py-3 font-galmuri9 text-[14px] text-ink shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
      >
        Google로 계속하기
      </button>
    </div>
  )
}