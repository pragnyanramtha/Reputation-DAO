import { Shield, Zap, Network, Lock, Users, TrendingUp } from "lucide-react";
import SpotlightCard from "../../../@/components/SpotlightCard";
import AnimatedContent from "../../../@/components/AnimatedContent";

const features = [
  {
    icon: Shield,
    title: "Immutable Trust",
    description: "Every reputation point is permanently recorded on-chain, creating an unalterable history of contributions and achievements.",
    metric: "100%",
    metricLabel: "Tamper-proof"
  },
  {
    icon: Zap,
    title: "Lightning Performance",
    description: "Query reputation scores in milliseconds. Built on ICP for instant verification without compromising decentralization.",
    metric: "<100ms",
    metricLabel: "Query time"
  },
  {
    icon: Network,
    title: "Fully Decentralized",
    description: "No single point of failure. Your reputation lives on a distributed network controlled by the community.",
    metric: "∞",
    metricLabel: "Uptime guarantee"
  }
];

const FeaturesShowcase = () => {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-[#0a0e1a]">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedContent
          distance={50}
          direction="vertical"
          reverse={false}
          config={{ tension: 80, friction: 20 }}
          initialOpacity={0.2}
          animateOpacity
          scale={1.1}
          threshold={0.2}
        >
          <div className="text-center mb-16 space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-500">Product pillars</p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
              Radically transforming trust,
              <span className="block bg-gradient-to-r from-blue-500 to-sky-500 bg-clip-text text-transparent">on-chain.</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We pared the interface back to clean cards so your team can scan the core ideas quickly—no parallax, no tilt,
              only the information that matters.
            </p>
          </div>
        </AnimatedContent>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <SpotlightCard
              key={feature.title}
              className="h-full bg-white/5 border-white/10 p-8 rounded-3xl"
              spotlightColor="rgba(59, 130, 246, 0.2)"
            >
              <div className="flex flex-col h-full text-center gap-6 relative z-10">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-400 grid place-items-center border border-blue-500/20">
                  <feature.icon className="w-8 h-8" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
                  <p className="text-base text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                <div className="pt-4 border-t border-white/10 mt-auto">
                  <div className="text-3xl font-bold text-blue-400">{feature.metric}</div>
                  <p className="text-sm text-gray-500">{feature.metricLabel}</p>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Lock, label: "Soulbound", value: "Non-transferable identity" },
            { icon: Users, label: "Community-owned", value: "Governed by members" },
            { icon: TrendingUp, label: "Composable", value: "Integrate anywhere" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center gap-4 shadow-sm hover:bg-white/10 transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-400 grid place-items-center border border-blue-500/20">
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-gray-400">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesShowcase;
