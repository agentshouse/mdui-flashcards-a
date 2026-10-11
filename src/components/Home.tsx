import { useState, useEffect } from "react";
import { Link } from "react-router";

const Home = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="w-full bg-white text-zinc-900">
      {/* Header */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled ? "bg-white/60 backdrop-blur-2xl border-b border-zinc-900/5" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-8 h-24 flex items-center justify-between">
          <Link to="/" className="text-2xl font-light tracking-[0.2em]">
            FLASHCARDS
          </Link>
          <nav className="hidden md:flex items-center gap-12">
            {["Features", "Showcase"].map(item => (
              <a key={item} href={`#/${item.toLowerCase()}`} onClick={(event) => {event.preventDefault(); document.getElementById(item.toLowerCase())?.scrollIntoView({behavior: "smooth"});}} className="text-sm tracking-wide relative group transition-colors duration-300 text-zinc-600 hover:text-zinc-900">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-zinc-900 group-hover:w-full transition-all duration-500" />
              </a>
            ))}
          </nav>
          <Link to="/create-deck" className="px-7 py-2.5 rounded-full text-sm tracking-wide font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-300 hover:scale-105">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0)`,
          backgroundSize: "40px 40px"
        }} />

        {/* Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full blur-3xl bg-blue-500/10" style={{ animation: "float 20s ease-in-out infinite" }} />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl bg-violet-500/10" style={{ animation: "float 25s ease-in-out infinite reverse" }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-8 pt-32 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border backdrop-blur-xl mb-12 bg-zinc-900/5 border-zinc-900/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm tracking-wide">Introducing Spaced Repetition Learning</span>
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-light tracking-tight leading-[0.9] mb-8">
            Learn anything,
            <br />
            <span className="font-extralight italic text-zinc-600">remember everything</span>
          </h1>

          <p className="text-lg sm:text-xl leading-relaxed mb-14 max-w-2xl mx-auto text-zinc-600">
              A focused flashcard platform built on spaced repetition science.
            <br />Shared through House, ready for focused practice.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Link to="/dashboard" className="group px-9 py-4 rounded-full text-sm tracking-wide font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-300 hover:scale-105">
              <span className="flex items-center gap-2">
                Start Learning
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </Link>
            <a href="./LICENSE.txt" target="_blank" rel="noopener noreferrer" className="px-9 py-4 rounded-full border text-sm tracking-wide font-medium backdrop-blur-xl border-zinc-900/10 hover:bg-zinc-900/5 transition-all duration-300 hover:scale-105">
              License & Notices
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
                { value: "Local-First", label: "Your House Room" },
                { value: "Open Source", label: "MIT Licensed" },
                { value: "Offline-Ready", label: "House manages sync" }
            ].map((stat, i) => (
              <div key={i} className="group">
                <div className="text-3xl sm:text-2xl font-light tracking-tight mb-2 text-zinc-900 group-hover:text-zinc-700 transition-colors">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm tracking-wide uppercase text-zinc-600">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <div className="inline-block px-5 py-2 rounded-full border backdrop-blur-xl mb-8 bg-white border-zinc-900/10">
              <span className="text-sm tracking-wide">Features</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight mb-6">
              Built for serious learners
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Spaced Repetition",
                desc: "Study due cards with the donor’s simple repetition schedule: one day, three days, then longer intervals.",
                img: "./artwork/card-1.svg"
              },
              {
                title: "Your House Room",
                desc: "Collections and review schedules are shared with the people who can access this Room.",
                img: "./artwork/card-2.svg"
              },
             {
                title: "Local-First Editing",
                desc: "House keeps a local copy, queues your edits, and synchronizes with your Room.",
                img: "./artwork/card-3.svg"
            }
            ,
              {
                title: "Open Architecture",
                desc: "MIT-licensed interface and local artwork, with preserved source and license notices.",
                img: "./artwork/card-4.svg"
              },
              {
                title: "Focused Practice",
                desc: "Flip a card, recall the answer, and choose whether to review it again.",
                img: "./artwork/card-5.svg"
              },
              {
                title: "Refined Interface",
                desc: "Meticulously designed for distraction-free learning",
                img: "./artwork/card-6.svg"
              }
            ].map((feature, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] bg-white">
                <div className="aspect-video overflow-hidden">
                  <img
                    src={feature.img}
                    alt={feature.title}
                    className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110 opacity-90"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-xl font-light tracking-tight mb-3">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="py-32">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-light tracking-tight mb-6">
              Elegant simplicity
            </h2>
          </div>

          <div className="space-y-32">
            {[
              {
                title: "Create Collections",
                desc: "Organize a topic into a named collection, with Markdown on both sides of each card.",
                img: "./artwork/card-7.svg"
              },
              {
                title: "Due-Card Study",
                desc: "Study the cards due now, or review the full collection without changing its schedule.",
                img: "./artwork/card-8.svg"
              },
              {
                title: "Follow Your Session",
                desc: "See the current card, session progress, and the number of cards due in each collection.",
                img: "./artwork/card-9.svg"
              }
            ].map((item, i) => (
              <div key={i} className={`flex flex-col ${i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} gap-16 items-center`}>
                <div className="flex-1">
                  <div className="rounded-2xl overflow-hidden bg-zinc-50">
                    <img src={item.img} className="w-full" alt={item.title} />
                  </div>
                </div>
                <div className="flex-1 space-y-6">
                  <h3 className="text-4xl font-light tracking-tight">{item.title}</h3>
                  <p className="text-lg leading-relaxed text-zinc-600">{item.desc}</p>

                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-indigo-50">

        <div className="max-w-7xl mx-auto px-8">
            <h2 className="text-4xl sm:text-5xl font-light tracking-tight text-center mb-20">
                On learning & memory
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                {
                    text: "Read the question, try your answer, then flip the card to compare.",
                    author: "Recall before revealing",
                    role: "A simple practice habit",
                },
                {
                    text: "Use “Forgot” to repeat a card or “Got It” to schedule its next review.",
                    author: "Choose your next review",
                    role: "Your shared Room schedule",
                },
                {
                    text: "Keep one idea on each card. Edit either side whenever your notes need refining.",
                    author: "Keep cards focused",
                    role: "Build a useful collection",
                },
                ].map((q, i) => (
                <div
                    key={i}
                    className="p-10 rounded-2xl bg-white transition-all duration-300 hover:scale-[1.02]"
                >
                    <p className="text-base leading-relaxed mb-8 italic text-zinc-700">
                    {q.text}
                    </p>
                    <div>
                    <div className="font-light tracking-tight mb-1">
                        {q.author}
                    </div>
                    <div className="text-sm tracking-wide text-zinc-600">
                        {q.role}
                    </div>
                    </div>
                </div>
                ))}
               </div>
            </div>
      </section>

      {/* CTA */}
      <section className="py-40 text-center">

        <div className="max-w-4xl mx-auto px-8">

          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[0.9] mb-8">
            Begin your
            <br />
            <span className="font-extralight italic text-zinc-600">learning journey</span>
          </h2>
          <p className="text-lg mb-12 text-zinc-600">Open your shared Room and start learning.</p>
          <Link to="/dashboard" className="inline-flex items-center gap-3 px-10 py-5 rounded-full text-base tracking-wide font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all duration-300 hover:scale-105">
            Launch Flashcards
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900/5 py-16 bg-indigo-100/40">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-xl font-bold tracking-[0.2em]">FLASHCARDS</div>
            <div className="flex gap-12">
              {["Licenses"].map(link => (
                <a key={link} href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener noreferrer" className="text-normal tracking-wide text-shadow-white hover:text-shadow-indigo-500 transition-colors">{link}</a>
              ))}
            </div>
          </div>
          <div className="text-center mt-12 text-sm tracking-wide text-zinc-600">
            Flashcards · Based on MIT-licensed work by Chris Carrington.
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
      `}</style>
    </div>
  );
};

export default Home;
