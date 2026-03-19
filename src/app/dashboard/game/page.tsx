'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const INITIAL_SPEED = 150;

export default function GamePage() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('theleads_snake_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Update high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('theleads_snake_highscore', score.toString());
    }
  }, [score, highScore]);

  const generateFood = useCallback(() => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check if food on snake
      const onSnake = snake.some(s => s.x === newFood!.x && s.y === newFood!.y);
      if (!onSnake) break;
    }
    setFood(newFood);
  }, [snake]);

  const moveSnake = useCallback(() => {
    if (gameOver || isPaused) return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        setIsPaused(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check if food eaten
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setSpeed(prev => Math.max(prev - 2, 60)); // Increase speed
        generateFood();
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, isPaused, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
        case ' ': // Space to pause/resume
          setIsPaused(p => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  useEffect(() => {
    gameLoopRef.current = setInterval(moveSnake, speed);
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [moveSnake, speed]);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setIsPaused(false);
    generateFood();
  };

  return (
    <div className="game-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Snake Productivity Break</h1>
          <p className="page-subtitle">Take a quick break and beat your high score!</p>
        </div>
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">SCORE</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">HIGH SCORE</span>
            <span className="stat-value">{highScore}</span>
          </div>
        </div>
      </div>

      <div className="game-wrapper">
        <div className="game-board-container">
          <div className="game-board" style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
          }}>
            {[...Array(GRID_SIZE * GRID_SIZE)].map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              const isSnakeHead = snake[0].x === x && snake[0].y === y;
              const isSnakeBody = snake.slice(1).some(s => s.x === x && s.y === y);
              const isFood = food.x === x && food.y === y;

              return (
                <div key={i} className={`grid-cell ${isSnakeHead ? 'snake-head' : ''} ${isSnakeBody ? 'snake-body' : ''} ${isFood ? 'food' : ''}`} />
              );
            })}
          </div>

          {(isPaused || gameOver) && (
            <div className="game-overlay">
              <div className="overlay-content">
                {gameOver ? (
                  <>
                    <h2 className="overlay-title">Game Over!</h2>
                    <p className="overlay-desc">Final Score: {score}</p>
                    <button className="btn btn-primary" onClick={resetGame}>Try Again</button>
                  </>
                ) : (
                  <>
                    <h2 className="overlay-title">Paused</h2>
                    <p className="overlay-desc">Use Arrows or WASD to move</p>
                    <button className="btn btn-primary" onClick={() => setIsPaused(false)}>Resume Game</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="game-controls">
          <div className="controls-card">
            <h3>Controls</h3>
            <div className="control-list">
              <div className="control-item"><span>⬆️ / W</span> Move Up</div>
              <div className="control-item"><span>⬇️ / S</span> Move Down</div>
              <div className="control-item"><span>⬅️ / A</span> Move Left</div>
              <div className="control-item"><span>➡️ / D</span> Move Right</div>
              <div className="control-item"><span>Space</span> Pause / Resume</div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '20px' }} onClick={resetGame}>Restart Game</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .game-container {
          max-width: 900px;
          margin: 0 auto;
        }
        .game-stats {
          display: flex;
          gap: 24px;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .stat-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-tertiary);
          letter-spacing: 1px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 800;
          color: var(--accent-blue);
        }
        .game-wrapper {
          display: grid;
          grid-template-columns: 1fr 240px;
          gap: 24px;
          margin-top: 24px;
          align-items: start;
        }
        .game-board-container {
          position: relative;
          aspect-ratio: 1;
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 8px;
          box-shadow: var(--shadow-lg);
        }
        .game-board {
          width: 100%;
          height: 100%;
          gap: 2px;
          background: #f4f5f7;
          border-radius: 4px;
          overflow: hidden;
        }
        .grid-cell {
          background: #ffffff;
          border-radius: 2px;
          transition: background 150ms ease;
        }
        .snake-head {
          background: var(--accent-blue);
          border-radius: 4px;
          box-shadow: 0 0 8px var(--accent-blue-glow);
          z-index: 2;
        }
        .snake-body {
          background: #4c9aff;
          border-radius: 3px;
        }
        .food {
          background: var(--accent-red);
          border-radius: 50%;
          transform: scale(0.8);
          box-shadow: 0 0 10px rgba(222, 53, 11, 0.4);
          animation: foodPulse 1s infinite alternate;
        }
        @keyframes foodPulse {
          from { transform: scale(0.7); }
          to { transform: scale(0.9); }
        }
        .game-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          border-radius: var(--radius-lg);
        }
        .overlay-content {
          text-align: center;
          padding: 32px;
          background: #ffffff;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-subtle);
          max-width: 280px;
        }
        .overlay-title {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        .overlay-desc {
          font-size: 15px;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }
        .controls-card {
          background: #ffffff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-md);
        }
        .controls-card h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 16px;
          color: var(--text-primary);
        }
        .control-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .control-item {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .control-item span {
          width: 70px;
          padding: 4px 8px;
          background: #f4f5f7;
          border: 1px solid var(--border-default);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
