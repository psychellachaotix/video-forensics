import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene3() {
  return (
    <SceneLayout className="bg-bg-dark relative overflow-hidden instrument-grid">
      
      <SafeFrame className="flex flex-col h-full z-10 p-[6vw] justify-center">
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-[70vw] mx-auto text-center mb-[8vh]"
        >
          <VideoText className="text-primary font-mono tracking-[0.2em] mb-6" size="sm">
            PHASE 03 / MANUAL OVERRIDE
          </VideoText>
          <VideoText className="text-text-primary font-display font-bold leading-tight" size="3xl">
            Disputed cases require human judgment.
          </VideoText>
          <VideoText className="text-text-secondary font-body mt-4 max-w-[50vw] mx-auto" size="sm">
            More than half of unavailable analysis steps forces an uncertain result. The system does not guess.
          </VideoText>
        </motion.div>

        {/* Verdict Buttons Container */}
        <div className="flex justify-center gap-[2vw]">
          {[
            { label: "ORIGINAL", color: "border-secondary text-text-primary bg-bg-muted", icon: "✓" },
            { label: "EDITED", color: "border-accent/50 text-accent bg-accent/10 shadow-[0_0_20px_rgba(255,170,64,0.2)]", icon: "⚠" },
            { label: "INCONCLUSIVE", color: "border-secondary text-text-secondary bg-bg-muted", icon: "?" }
          ].map((btn, i) => (
            <motion.div
              key={i}
              className={`px-[3vw] py-[2vh] border ${btn.color} rounded-md flex items-center gap-[1vw]`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + (i * 0.1), type: "spring" }}
              whileHover={{ scale: 1.05 }}
            >
              <VideoText className="font-mono font-bold" size="sm">{btn.icon}</VideoText>
              <VideoText className="font-mono tracking-wider" size="xs">{btn.label}</VideoText>
            </motion.div>
          ))}
        </div>

        {/* Decorative central line connecting to next phase */}
        <motion.div 
          className="absolute bottom-0 left-1/2 w-[2px] bg-gradient-to-b from-primary/50 to-transparent"
          initial={{ height: 0 }}
          animate={{ height: "15vh" }}
          transition={{ duration: 1, delay: 1 }}
        />

      </SafeFrame>
    </SceneLayout>
  );
}