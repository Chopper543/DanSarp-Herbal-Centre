"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BotanicalParticles } from "@/components/particles/BotanicalParticles";
import { HeroParallax } from "@/components/animations/HeroParallax";

const messages = [
  "Restoring Health. Naturally.",
  "Your Healing Journey Begins Here.",
  "Nature's Wisdom, Modern Care.",
];

export function HeroSection() {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const message = messages[currentMessage];
    let index = 0;
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      if (index < message.length) {
        setDisplayText(message.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        
        // Wait 3 seconds then move to next message
        setTimeout(() => {
          setCurrentMessage((prev) => (prev + 1) % messages.length);
        }, 3000);
      }
    }, 100);

    return () => clearInterval(typeInterval);
  }, [currentMessage]);

  return (
    <HeroParallax>
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <BotanicalParticles />
        
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/40 via-primary-800/30 to-primary-900/60 dark:from-gray-900/60 dark:via-gray-800/40 dark:to-gray-900/80 pointer-events-none" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              <span className="block mb-2">DanSarp Herbal Centre</span>
              <span className="text-3xl md:text-5xl font-serif text-primary-200">
                {displayText}
                {isTyping && <span className="animate-pulse">|</span>}
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
              Certified Professional Herbal Clinic
              <br />
              Transforming lives through nature's healing power
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Link href="/appointments">
                <Button
                  size="lg"
                  className="group relative overflow-hidden bg-primary-600 hover:bg-primary-950 text-white px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <span className="relative z-10 font-semibold">Book Appointment</span>
                  <span className="absolute inset-0 bg-primary-950 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                </Button>
              </Link>
              
              <Link href="/treatments">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white text-white hover:bg-white hover:text-primary-600 px-8 py-4 text-lg backdrop-blur-sm"
                >
                  Start Your Healing Journey
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </div>
    </HeroParallax>
  );
}
