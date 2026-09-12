import { motion } from 'framer-motion';
import { SceneLayout, SafeFrame, VideoText } from '@/lib/video';

export function Scene1() {
  return (
    <SceneLayout className="bg-bg-dark instrument-grid relative overflow-hidden">
      {/* Background Image with Overlay */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.3 }}
        transition={{ duration: 2, ease: "easeOut" }}
      >
        <img src={`${import.meta.env.BASE_URL}images/tech-dashboard-bg.jpg`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-bg-dark/80 mix-blend-multiply" />
      </motion.div>

      <SafeFrame className="flex flex-col justify-center h-full z-10 px-[8vw]">
        <div className="flex w-full items-center gap-[4vw]">
          <div className="flex-1 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <VideoText className="text-primary font-mono tracking-[0.2em] mb-4" size="xs">
                PHASE 01 / INTAKE
              </VideoText>
              
              <VideoText className="text-text-primary font-display font-bold leading-[1.1]" size="3xl">
                Secure Evidence Handling
              </VideoText>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <VideoText className="text-text-secondary font-body max-w-[40vw] leading-relaxed" size="sm">
                Multi-video upload for MP4, MOV, AVI, and MKV files up to 2 GB. 
                Direct-to-storage presigned URLs ensure the API only handles metadata and object paths.
              </VideoText>
            </motion.div>
          </div>

          <div className="flex-1">
             {/* Abstract Upload UI representation */}
             <motion.div 
                className="w-full aspect-[4/3] border border-secondary bg-bg-muted/80 backdrop-blur-md rounded-lg p-[2vw] flex flex-col justify-between scanline"
                initial={{ opacity: 0, scale: 0.95, rotateY: 15 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 1, delay: 0.6, type: "spring", stiffness: 100 }}
                style={{ perspective: 1000 }}
             >
                <div className="flex justify-between items-center border-b border-secondary pb-[1vw]">
                  <VideoText className="font-mono text-text-secondary" size="xs">EVIDENCE_DROP.ZONE</VideoText>
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                   <motion.div 
                     className="w-16 h-16 border-2 border-dashed border-primary/50 rounded-full flex items-center justify-center"
                     animate={{ rotate: 360 }}
                     transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                   >
                     <div className="w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-md" />
                   </motion.div>
                   <VideoText className="text-text-primary font-mono" size="sm">WAITING_FOR_FILES</VideoText>
                </div>

                {/* Progress bars */}
                <div className="space-y-3">
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 3, delay: 1, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary/60"
                      initial={{ width: "0%" }}
                      animate={{ width: "45%" }}
                      transition={{ duration: 2, delay: 1.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
             </motion.div>
          </div>
        </div>
      </SafeFrame>
    </SceneLayout>
  );
}