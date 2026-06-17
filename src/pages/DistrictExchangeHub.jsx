import { Link } from 'react-router-dom';
import { Play, Users, Trophy } from 'lucide-react';

export default function DistrictExchangeHub() {
  return (
    <div className="fade-in space-y-12">
      <header className="text-center space-y-4 py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-green-500/10 dark:bg-green-500/5 -z-10 blur-3xl"></div>
        <div className="font-mono text-sm tracking-[0.3em] uppercase opacity-60">Property Trading</div>
        <h1 className="font-display text-5xl sm:text-7xl">District Exchange</h1>
        <p className="max-w-xl mx-auto text-lg opacity-80 font-sans leading-relaxed">
          Buy, trade, and upgrade districts. Bankrupt your opponents in this classic property trading experience with a modern twist.
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/district-exchange/local" className="card interactive p-6 space-y-4 group">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
          <div>
            <h2 className="font-display text-2xl mb-1">Local Match</h2>
            <p className="font-sans text-sm opacity-70">Play offline with friends or against AI bots on the same device.</p>
          </div>
        </Link>

        <div className="card p-6 space-y-4 opacity-50 grayscale cursor-not-allowed">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
            <Play size={24} />
          </div>
          <div>
            <h2 className="font-display text-2xl mb-1">Online Lobby</h2>
            <p className="font-sans text-sm opacity-70">Host or join live games. (Coming Soon)</p>
          </div>
        </div>

        <div className="card p-6 space-y-4 opacity-50 grayscale cursor-not-allowed md:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-500">
            <Trophy size={24} />
          </div>
          <div>
            <h2 className="font-display text-2xl mb-1">Ranked</h2>
            <p className="font-sans text-sm opacity-70">Compete for the highest net worth globally. (Coming Soon)</p>
          </div>
        </div>
      </div>

      <section className="card p-8 space-y-6">
         <h2 className="font-display text-3xl">Rules of Exchange</h2>
         <div className="grid sm:grid-cols-2 gap-8 font-sans">
            <div className="space-y-2">
               <h3 className="font-bold">Objective</h3>
               <p className="text-sm opacity-80">Be the last remaining solvent player. Acquire monopolies to build Upgrades (Shed, Shop, Block, Tower) and drive your opponents into bankruptcy.</p>
            </div>
            <div className="space-y-2">
               <h3 className="font-bold">The Turn</h3>
               <p className="text-sm opacity-80">Roll two dice. If you roll doubles, you roll again after your action. Three consecutive doubles sends you to the Holding Cell.</p>
            </div>
            <div className="space-y-2">
               <h3 className="font-bold">Auctions</h3>
               <p className="text-sm opacity-80">If you land on an unowned property and choose not to buy it at the listed price, it goes up for live auction where any player can bid.</p>
            </div>
            <div className="space-y-2">
               <h3 className="font-bold">Holding Cell</h3>
               <p className="text-sm opacity-80">You can be detained via cards, landing on Compliance Office, or speeding (3 doubles). Pay 50 Credits, use a release card, or roll doubles to escape.</p>
            </div>
         </div>
      </section>
    </div>
  );
}
