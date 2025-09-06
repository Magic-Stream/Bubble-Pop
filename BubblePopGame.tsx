import React, { useState, useEffect, useCallback, useRef } from 'react';

const BubblePopGame = () => {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [bubbles, setBubbles] = useState([]);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bubblesPopped, setBubblesPopped] = useState(0);
  const [particles, setParticles] = useState([]);
  const [comboTexts, setComboTexts] = useState([]);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  
  const gameContainerRef = useRef(null);
  const lastPopTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  const gameStatsRef = useRef({
    bubbleSpeed: 2000,
    maxBubbles: 5,
    bubbleLifetime: 3500,
    addMovingBubbles: false,
    tinyBubbles: false
  });

  const appleGlassColors = [
    'rgba(0, 122, 255, 0.8)',     // iOS Blue
    'rgba(52, 199, 89, 0.8)',     // iOS Green  
    'rgba(255, 149, 0, 0.8)',     // iOS Orange
    'rgba(255, 59, 48, 0.8)',     // iOS Red
    'rgba(175, 82, 222, 0.8)',    // iOS Purple
    'rgba(255, 204, 0, 0.8)',     // iOS Yellow
    'rgba(90, 200, 250, 0.8)',    // iOS Light Blue
    'rgba(255, 45, 85, 0.8)',     // iOS Pink
    'rgba(50, 215, 75, 0.8)',     // iOS Mint
    'rgba(191, 90, 242, 0.8)',    // iOS Lavender
    'rgba(255, 214, 10, 0.8)',    // iOS Amber
    'rgba(64, 200, 224, 0.8)'     // iOS Teal
  ];

  // Audio functions
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.log('Audio not supported');
      }
    }
  }, []);

  const playSound = useCallback((frequency, duration, type = 'sine', volume = 0.1) => {
    if (!audioContextRef.current) return;
    
    try {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
      
      gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + duration);
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  }, []);

  const playPopSound = useCallback((bubbleSize) => {
    const frequency = 800 - (bubbleSize * 4) + Math.random() * 100;
    playSound(frequency, 0.1, 'sine', 0.15);
  }, [playSound]);

  const playComboSound = useCallback((comboLevel) => {
    const baseFreq = 400 + (comboLevel * 100);
    playSound(baseFreq, 0.15, 'triangle', 0.2);
    setTimeout(() => {
      playSound(baseFreq + 200, 0.1, 'triangle', 0.15);
    }, 50);
  }, [playSound]);

  const playLevelUpSound = useCallback(() => {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        playSound(freq, 0.3, 'triangle', 0.2);
      }, index * 100);
    });
  }, [playSound]);

  // Game functions
  const createParticles = useCallback((x, y) => {
    const newParticles = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const distance = 40 + Math.random() * 30;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      
      newParticles.push({
        id: Date.now() + i,
        x: x,
        y: y,
        dx: dx,
        dy: dy
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 800);
  }, []);

  const showCombo = useCallback((x, y, comboCount) => {
    const comboText = {
      id: Date.now(),
      x: x,
      y: y,
      combo: comboCount
    };
    
    setComboTexts(prev => [...prev, comboText]);
    
    setTimeout(() => {
      setComboTexts(prev => prev.filter(c => c.id !== comboText.id));
    }, 1200);
  }, []);

  const popBubble = useCallback((bubbleId) => {
    setBubbles(prev => {
      const bubble = prev.find(b => b.id === bubbleId);
      if (!bubble) return prev;

      const currentTime = Date.now();
      const timeSinceLastPop = currentTime - lastPopTimeRef.current;
      
      playPopSound(bubble.size);
      
      let newCombo = 1;
      if (timeSinceLastPop < 1000) {
        newCombo = combo + 1;
      }
      
      lastPopTimeRef.current = currentTime;
      setCombo(newCombo);

      let points = bubble.points;
      if (newCombo > 1) {
        points *= newCombo;
        showCombo(bubble.x + bubble.size / 2, bubble.y + bubble.size / 2, newCombo);
        playComboSound(newCombo);
      }

      setScore(prevScore => prevScore + points);
      setBubblesPopped(prev => prev + 1);
      createParticles(bubble.x + bubble.size / 2, bubble.y + bubble.size / 2);

      return prev.filter(b => b.id !== bubbleId);
    });
  }, [combo, playPopSound, playComboSound, showCombo, createParticles]);

  const spawnBubble = useCallback(() => {
    if (!gameRunning || bubbles.length >= gameStatsRef.current.maxBubbles) return;

    const container = gameContainerRef.current;
    if (!container) return;

    let baseSize = Math.max(25, 80 - (level * 4));
    
    if (gameStatsRef.current.tinyBubbles && Math.random() < 0.3) {
      baseSize = Math.max(20, baseSize - 20);
    }
    
    const size = Math.random() * 30 + baseSize;
    const x = Math.random() * (container.clientWidth - size);
    const y = Math.random() * (container.clientHeight - size);
    const color = appleGlassColors[Math.floor(Math.random() * appleGlassColors.length)];
    
    const newBubble = {
      id: Date.now() + Math.random(),
      size: size,
      x: x,
      y: y,
      color: color,
      points: Math.floor((120 - size) / 3) + level * 2,
      moving: gameStatsRef.current.addMovingBubbles && Math.random() < 0.4,
      spawning: true
    };

    setBubbles(prev => [...prev, newBubble]);

    // Remove spawning animation
    setTimeout(() => {
      setBubbles(prev => prev.map(b => 
        b.id === newBubble.id ? { ...b, spawning: false } : b
      ));
    }, 400);

    // Remove bubble after lifetime
    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== newBubble.id));
    }, gameStatsRef.current.bubbleLifetime);
  }, [gameRunning, bubbles.length, level]);

  const levelUp = useCallback(() => {
    gameStatsRef.current.bubbleSpeed = Math.max(200, gameStatsRef.current.bubbleSpeed - 200);
    gameStatsRef.current.maxBubbles = Math.min(15, gameStatsRef.current.maxBubbles + 2);
    gameStatsRef.current.bubbleLifetime = Math.max(800, 3500 - (level * 300));
    
    const bonusTime = Math.max(3, 12 - level);
    setTimeLeft(prev => prev + bonusTime);
    
    if (level >= 5) {
      gameStatsRef.current.addMovingBubbles = true;
    }
    
    if (level >= 8) {
      gameStatsRef.current.tinyBubbles = true;
    }

    setLevelUpVisible(true);
    playLevelUpSound();
    
    setTimeout(() => {
      setLevelUpVisible(false);
    }, 2500);
  }, [level, playLevelUpSound]);

  const handleClick = useCallback((e) => {
    if (!gameRunning) return;
    
    initAudio();
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const rect = gameContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedBubble = bubbles.find(bubble => {
      const centerX = bubble.x + bubble.size / 2;
      const centerY = bubble.y + bubble.size / 2;
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + 
        Math.pow(y - centerY, 2)
      );
      return distance < bubble.size / 2;
    });

    if (clickedBubble) {
      popBubble(clickedBubble.id);
    }
  }, [gameRunning, bubbles, popBubble, initAudio]);

  const startGame = useCallback(() => {
    setScore(0);
    setLevel(1);
    setTimeLeft(60);
    setBubbles([]);
    setCombo(0);
    setBubblesPopped(0);
    setGameRunning(true);
    setGameOver(false);
    setParticles([]);
    setComboTexts([]);
    
    gameStatsRef.current = {
      bubbleSpeed: 2000,
      maxBubbles: 5,
      bubbleLifetime: 3500,
      addMovingBubbles: false,
      tinyBubbles: false
    };
    
    initAudio();
  }, [initAudio]);

  const endGame = useCallback(() => {
    setGameRunning(false);
    setGameOver(true);
    setBubbles([]);
  }, []);

  // Effects
  useEffect(() => {
    if (!gameRunning) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameRunning, endGame]);

  useEffect(() => {
    if (!gameRunning) return;

    const interval = setInterval(() => {
      spawnBubble();
    }, gameStatsRef.current.bubbleSpeed);

    return () => clearInterval(interval);
  }, [gameRunning, spawnBubble]);

  useEffect(() => {
    const bubblesNeededForNextLevel = level * 10;
    if (bubblesPopped >= bubblesNeededForNextLevel && gameRunning) {
      setLevel(prev => prev + 1);
      setBubblesPopped(0);
      levelUp();
    }
  }, [bubblesPopped, level, gameRunning, levelUp]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const restartGame = () => {
    startGame();
  };

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Glassy translucent background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 20%, rgba(52, 199, 89, 0.12) 0%, transparent 40%),
            radial-gradient(circle at 40% 80%, rgba(255, 149, 0, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 90% 70%, rgba(175, 82, 222, 0.08) 0%, transparent 40%),
            linear-gradient(135deg, 
              rgba(255, 255, 255, 0.9) 0%, 
              rgba(255, 255, 255, 0.7) 25%,
              rgba(240, 248, 255, 0.8) 50%,
              rgba(248, 250, 252, 0.9) 75%,
              rgba(255, 255, 255, 0.95) 100%
            )
          `,
          backdropFilter: 'blur(80px) saturate(150%)',
          WebkitBackdropFilter: 'blur(80px) saturate(150%)'
        }}
      />
      
      {/* Glass texture overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.03) 2px,
              rgba(255, 255, 255, 0.03) 4px
            ),
            repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.02) 2px,
              rgba(255, 255, 255, 0.02) 4px
            )
          `
        }}
      />
      
      {/* Animated glass reflections */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            linear-gradient(
              120deg,
              transparent 0%,
              rgba(255, 255, 255, 0.4) 45%,
              rgba(255, 255, 255, 0.6) 50%,
              rgba(255, 255, 255, 0.4) 55%,
              transparent 100%
            )
          `,
          animation: 'glassReflection 8s ease-in-out infinite'
        }}
      />

      {/* Game Header - Fully Translucent Glass Style */}
      <div 
        className="relative z-10 p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
        }}
      >
        <div className="flex justify-between items-center">
          <div 
            className="text-lg font-semibold px-5 py-3 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#1d1d1f',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            Score: <span style={{ color: '#007AFF', fontWeight: 'bold' }}>{score}</span>
          </div>
          <div 
            className="px-6 py-3 rounded-2xl text-white font-bold text-lg"
            style={{
              background: 'rgba(0, 122, 255, 0.8)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 24px rgba(0, 122, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
            }}
          >
            Level {level}
          </div>
          <div 
            className="text-lg font-semibold px-5 py-3 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#1d1d1f',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            Time: <span style={{ color: '#FF3B30', fontWeight: 'bold' }}>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div 
        ref={gameContainerRef}
        className="relative flex-1 cursor-pointer"
        onClick={handleClick}
        style={{ height: 'calc(100vh - 120px)' }}
      >
        {/* Bubbles - Apple Liquid Glass Style */}
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`absolute rounded-full cursor-pointer transition-all duration-300 ease-out hover:scale-110 active:scale-95 ${
              bubble.spawning ? 'animate-pulse' : ''
            }`}
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: `${bubble.x}px`,
              top: `${bubble.y}px`,
              background: `
                linear-gradient(135deg, 
                  ${bubble.color} 0%,
                  ${bubble.color.replace('0.8', '0.9')} 50%,
                  ${bubble.color.replace('0.8', '0.7')} 100%
                )
              `,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: `
                0 8px 32px ${bubble.color.replace('0.8', '0.2')},
                inset 0 2px 4px rgba(255, 255, 255, 0.3),
                0 1px 0 rgba(255, 255, 255, 0.6)
              `,
              animation: bubble.moving ? 
                'liquidFloat 2s ease-in-out infinite, liquidMove 4s linear infinite' : 
                'liquidFloat 3s ease-in-out infinite'
            }}
          />
        ))}

        {/* Particles - Liquid Glass Effect */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-3 h-3 rounded-full pointer-events-none"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              background: 'linear-gradient(45deg, rgba(0, 122, 255, 0.8), rgba(255, 255, 255, 0.9))',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 8px rgba(0, 122, 255, 0.3)',
              animation: 'liquidExplode 0.8s ease-out forwards',
              transform: `translate(${particle.dx}px, ${particle.dy}px)`
            }}
          />
        ))}

        {/* Combo Texts */}
        {comboTexts.map((comboText) => (
          <div
            key={comboText.id}
            className="absolute text-2xl font-bold pointer-events-none"
            style={{
              left: `${comboText.x}px`,
              top: `${comboText.y}px`,
              background: 'linear-gradient(135deg, #007AFF, #5856D6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              animation: 'liquidFloat 1.2s ease-out forwards'
            }}
          >
            ×{comboText.combo} COMBO
          </div>
        ))}

        {/* Level Up Notification - Fully Translucent */}
        {levelUpVisible && (
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center p-8 rounded-3xl z-50"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 0.5)',
              animation: 'liquidPulse 2.5s ease-out forwards'
            }}
          >
            <div 
              className="text-4xl font-bold mb-2"
              style={{
                background: 'linear-gradient(135deg, #007AFF, #5856D6, #AF52DE)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
              }}
            >
              Level {level}
            </div>
            <div className="text-lg font-medium" style={{ color: 'rgba(0, 0, 0, 0.7)' }}>
              Next Challenge Unlocked
            </div>
          </div>
        )}
      </div>

      {/* Game Over Modal - Fully Translucent Glass */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div 
            className="text-center p-10 rounded-3xl max-w-md mx-4"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            <h2 
              className="text-4xl font-bold mb-6"
              style={{
                background: 'linear-gradient(135deg, #FF3B30, #FF9500)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
              }}
            >
              Game Over
            </h2>
            <div className="space-y-3 mb-8">
              <p className="text-xl font-semibold" style={{ color: 'rgba(0, 0, 0, 0.8)' }}>
                Score: <span className="font-bold" style={{ color: '#007AFF' }}>{score}</span>
              </p>
              <p className="text-lg font-medium" style={{ color: 'rgba(0, 0, 0, 0.7)' }}>
                Level: <span className="font-semibold">{level}</span>
              </p>
            </div>
            <button
              onClick={restartGame}
              className="px-8 py-4 text-white font-semibold text-lg rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(0, 122, 255, 0.8)',
                backdropFilter: 'blur(20px) saturate(200%)',
                WebkitBackdropFilter: 'blur(20px) saturate(200%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 24px rgba(0, 122, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes liquidFloat {
          0%, 100% { 
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
          50% { 
            transform: translateY(-8px) scale(1.05);
            opacity: 0.9;
          }
        }

        @keyframes liquidMove {
          0% { transform: translateX(0); }
          25% { transform: translateX(20px); }
          50% { transform: translateX(0); }
          75% { transform: translateX(-20px); }
          100% { transform: translateX(0); }
        }

        @keyframes liquidExplode {
          0% { 
            transform: scale(1) translate(0, 0);
            opacity: 1;
          }
          100% { 
            transform: scale(0.5) translate(var(--dx, 0), var(--dy, 0));
            opacity: 0;
          }
        }

        @keyframes liquidPulse {
          0% { 
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
          }
          20% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
          80% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
        }

        @keyframes glassReflection {
          0% {
            transform: translateX(-100%) rotate(45deg);
          }
          50% {
            transform: translateX(100vw) rotate(45deg);
          }
          100% {
            transform: translateX(-100%) rotate(45deg);
          }
        }
      `}</style>
    </div>
  );
};

export default BubblePopGame;
