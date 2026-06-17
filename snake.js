const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const foodImage = new Image();
foodImage.src = 'assets/food.png';

const gridSize = 25;
const cellSize = canvas.width / gridSize;
let speed = 100;

let snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 },
    { x: 9, y: 12 }
];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let level = 1;
let gameOver = false;
let foodLoaded = false;

// ===== FLOORS =====
// There is only ONE snake. It shares the same x/y position on every
// floor — switching floors does not move it on the grid, it just
// changes which walls and which food currently apply to it.

const totalFloors = 4;
let currentFloor = 0;

// floorWalls[floorIndex] = a Set of "x,y" strings that are blocked on that floor
let floorWalls = [];

// floorFoods[floorIndex] = that floor's current food position { x, y }
let floorFoods = [];

// Builds the wall ring for one floor.
// Floor 0 is fully open. Each floor after that has a tighter inset
// ring of walls (with a few gaps so the snake is never fully sealed in),
// leaving a smaller open rectangle to move around in.
function buildFloorWalls(floorIndex) {
    const walls = new Set();

    if (floorIndex === 0) {
        return walls; // ground floor: no walls, full grid open
    }

    const inset = floorIndex * 2; // higher floors = tighter ring

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            const onRing =
                x === inset || x === gridSize - 1 - inset ||
                y === inset || y === gridSize - 1 - inset;
            const inBounds =
                x >= inset && x <= gridSize - 1 - inset &&
                y >= inset && y <= gridSize - 1 - inset;

            if (onRing && inBounds) {
                walls.add(`${x},${y}`);
            }
        }
    }

    // Carve gaps in the middle of each side of the ring so there's
    // always a way through
    const gapSize = 3;
    const mid = Math.floor(gridSize / 2);
    for (let g = -gapSize; g <= gapSize; g++) {
        walls.delete(`${mid + g},${inset}`);
        walls.delete(`${mid + g},${gridSize - 1 - inset}`);
        walls.delete(`${inset},${mid + g}`);
        walls.delete(`${gridSize - 1 - inset},${mid + g}`);
    }

    return walls;
}

function buildAllFloors() {
    floorWalls = [];
    for (let f = 0; f < totalFloors; f++) {
        floorWalls.push(buildFloorWalls(f));
    }
}


// New variables for special food
let specialFood = null;
let specialFoodTimer = null;
let specialFoodActive = false;
let animationFrame = 0;
let pulseDirection = 1;

// Wait for food image to load
foodImage.onload = () => {
    foodLoaded = true;
    if (!gameOver) {
        drawBoard();
        drawSnake();
        drawFood();
        drawScore();
    }
};

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#07101f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    drawWalls();
}

function drawWalls() {
    const walls = floorWalls[currentFloor];
    if (!walls || walls.size === 0) return;

    ctx.fillStyle = 'rgba(124, 58, 237, 0.5)';
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)';
    ctx.lineWidth = 1;

    walls.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 2, cellSize - 2);
    });
}

function drawSnake() {
    snake.forEach((segment, index) => {
        const gradient = ctx.createLinearGradient(
            segment.x * cellSize, 
            segment.y * cellSize,
            segment.x * cellSize + cellSize, 
            segment.y * cellSize + cellSize
        );
        
        if (index === 0) {
            gradient.addColorStop(0, '#22d3ee');
            gradient.addColorStop(1, '#06b6d4');
            ctx.fillStyle = gradient;
        } else {
            gradient.addColorStop(0, '#7dd3fc');
            gradient.addColorStop(1, '#38bdf8');
            ctx.fillStyle = gradient;
        }
        
        ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize - 1, cellSize - 1);
        
        if (index === 0) {
            ctx.fillStyle = '#ffffff';
            const eyeSize = cellSize * 0.2;
            const eyeOffset = cellSize * 0.25;
            
            if (direction.x === 1) {
                ctx.fillRect(segment.x * cellSize + cellSize - eyeOffset, segment.y * cellSize + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * cellSize + cellSize - eyeOffset, segment.y * cellSize + cellSize - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction.x === -1) {
                ctx.fillRect(segment.x * cellSize + eyeOffset - eyeSize, segment.y * cellSize + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * cellSize + eyeOffset - eyeSize, segment.y * cellSize + cellSize - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction.y === -1) {
                ctx.fillRect(segment.x * cellSize + eyeOffset, segment.y * cellSize + eyeOffset - eyeSize, eyeSize, eyeSize);
                ctx.fillRect(segment.x * cellSize + cellSize - eyeOffset - eyeSize, segment.y * cellSize + eyeOffset - eyeSize, eyeSize, eyeSize);
            } else {
                ctx.fillRect(segment.x * cellSize + eyeOffset, segment.y * cellSize + cellSize - eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x * cellSize + cellSize - eyeOffset - eyeSize, segment.y * cellSize + cellSize - eyeOffset, eyeSize, eyeSize);
            }
        }
    });
}

function drawFood() {
    // Animate regular food (pulsing effect)
    animationFrame += 0.05 * pulseDirection;
    if (animationFrame >= 1) pulseDirection = -1;
    if (animationFrame <= 0) pulseDirection = 1;
    
    const scale = 0.8 + (Math.sin(Date.now() * 0.008) * 0.1);
    const food = floorFoods[currentFloor];

    if (food) {
        if (foodLoaded && foodImage.complete) {
            const size = cellSize - (4 * scale);
            const offset = (cellSize - size) / 2;

            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f97316';
            ctx.drawImage(
                foodImage,
                food.x * cellSize + offset,
                food.y * cellSize + offset,
                size,
                size
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(food.x * cellSize + 2, food.y * cellSize + 2, cellSize - 4, cellSize - 4);
        }
    }
    
    // Draw special food if active
    if (specialFoodActive && specialFood) {
        const pulseScale = 0.8 + (Math.sin(Date.now() * 0.012) * 0.15);
        const size = cellSize - 2;
        const offset = (cellSize - size) / 2;
        
        // Draw glowing effect
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fbbf24';
        
        // Draw gold border
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            specialFood.x * cellSize + offset - 2,
            specialFood.y * cellSize + offset - 2,
            size + 4,
            size + 4
        );
        
        if (foodLoaded && foodImage.complete) {
            // Draw larger food with gold tint
            ctx.drawImage(
                foodImage,
                specialFood.x * cellSize + offset - 2,
                specialFood.y * cellSize + offset - 2,
                size + 4,
                size + 4
            );
            
            // Add gold overlay
            ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
            ctx.fillRect(
                specialFood.x * cellSize + offset - 2,
                specialFood.y * cellSize + offset - 2,
                size + 4,
                size + 4
            );
        } else {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(
                specialFood.x * cellSize + offset - 2,
                specialFood.y * cellSize + offset - 2,
                size + 4,
                size + 4
            );
        }
        
        // Draw stars around special food
        ctx.fillStyle = '#fbbf24';
        for (let i = 0; i < 4; i++) {
            const angle = Date.now() * 0.005 + (i * Math.PI * 2 / 4);
            const starX = specialFood.x * cellSize + cellSize / 2 + Math.cos(angle) * cellSize * 0.7;
            const starY = specialFood.y * cellSize + cellSize / 2 + Math.sin(angle) * cellSize * 0.7;
            ctx.beginPath();
            ctx.arc(starX, starY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Draw "2X" text on special food
        ctx.font = `bold ${Math.floor(cellSize * 0.35)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2X', specialFood.x * cellSize + cellSize / 2, specialFood.y * cellSize + cellSize / 2);
        ctx.shadowBlur = 0;
    }
}

function drawScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
}

function spawnSpecialFood() {
    if (specialFoodTimer) clearTimeout(specialFoodTimer);
    if (specialFoodActive) return;
    
    // 15% chance to spawn special food after each regular food eaten
    const randomChance = Math.random();
    if (randomChance < 0.15 && !gameOver) {
        const occupied = new Set(snake.map(part => `${part.x},${part.y}`));
        occupied.add(`${food.x},${food.y}`);
        
        let position;
        let attempts = 0;
        
        do {
            position = {
                x: Math.floor(Math.random() * gridSize),
                y: Math.floor(Math.random() * gridSize)
            };
            attempts++;
            if (attempts > 500) return;
        } while (occupied.has(`${position.x},${position.y}`));
        
        specialFood = position;
        specialFoodActive = true;
        
        // Special food disappears after 5 seconds
        specialFoodTimer = setTimeout(() => {
            specialFoodActive = false;
            specialFood = null;
            drawBoard();
            drawSnake();
            drawFood();
            drawScore();
        }, 5000);
    }
}

function placeFood(floorIndex = currentFloor) {
    // Only avoid the snake's body when placing food on the floor the
    // snake is currently on. Other floors just need to avoid their walls.
    const occupied = new Set();
    if (floorIndex === currentFloor) {
        snake.forEach(part => occupied.add(`${part.x},${part.y}`));
        if (specialFoodActive && specialFood) {
            occupied.add(`${specialFood.x},${specialFood.y}`);
        }
    }

    const walls = floorWalls[floorIndex] || new Set();

    let position;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
        position = {
            x: Math.floor(Math.random() * gridSize),
            y: Math.floor(Math.random() * gridSize)
        };
        attempts++;
        if (attempts > maxAttempts) {
            // No free space left on this floor — extremely rare, just skip
            return;
        }
    } while (
        walls.has(`${position.x},${position.y}`) ||
        occupied.has(`${position.x},${position.y}`)
    );

    floorFoods[floorIndex] = position;

    // Special food only ever spawns relative to the floor the
    // snake is actually standing on
    if (floorIndex === currentFloor) {
        spawnSpecialFood();
    }
}

// Makes sure every floor has food on it. Called once at game start.
function stockAllFloors() {
    for (let f = 0; f < totalFloors; f++) {
        placeFood(f);
    }
}

function isCollision(head) {
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
        return true;
    }
    if (floorWalls[currentFloor] && floorWalls[currentFloor].has(`${head.x},${head.y}`)) {
        return true;
    }
    return snake.some(segment => segment.x === head.x && segment.y === head.y);
}

function update() {
    if (gameOver) {
        return;
    }

    direction = nextDirection;
    const newHead = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    if (isCollision(newHead)) {
        gameOver = true;
        if (specialFoodTimer) clearTimeout(specialFoodTimer);
        drawBoard();
        drawSnake();
        drawFood();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 32px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '18px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Press Space to play again', canvas.width / 2, canvas.height / 2 + 20);
        return;
    }

    snake.unshift(newHead);
    
    let ateFood = false;
    let pointsEarned = 0;
    
    // Check for special food first
    if (specialFoodActive && specialFood && newHead.x === specialFood.x && newHead.y === specialFood.y) {
        ateFood = true;
        pointsEarned = 20; // Double points!
        score += pointsEarned;
        
        // Visual feedback for double points
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${Math.floor(cellSize * 0.5)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        
        specialFoodActive = false;
        if (specialFoodTimer) clearTimeout(specialFoodTimer);
        specialFood = null;
    }
    // Then check for regular food
    else if (floorFoods[currentFloor] && newHead.x === floorFoods[currentFloor].x && newHead.y === floorFoods[currentFloor].y) {
        ateFood = true;
        pointsEarned = 10;
        score += pointsEarned;
    }
    
    if (ateFood) {
        if (score % 50 === 0 && score > 0) {
            level += 1;
        }
        placeFood();
        drawScore();
        
        // Show floating text for points
        drawBoard();
        drawSnake();
        drawFood();
        
        ctx.fillStyle = pointsEarned === 20 ? '#fbbf24' : '#22d3ee';
        ctx.font = `bold ${Math.floor(cellSize * 0.4)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(`+${pointsEarned}`, newHead.x * cellSize + cellSize / 2, newHead.y * cellSize - 5);
        
        setTimeout(() => {
            if (!gameOver) {
                drawBoard();
                drawSnake();
                drawFood();
                drawScore();
            }
        }, 200);
    } else {
        snake.pop();
    }

    drawBoard();
    drawSnake();
    drawFood();
    drawScore();
}

function restartGame() {
    snake = [
        { x: 12, y: 12 },
        { x: 11, y: 12 },
        { x: 10, y: 12 },
        { x: 9, y: 12 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    level = 1;
    gameOver = false;
    specialFoodActive = false;
    specialFood = null;
    currentFloor = 0;
    if (specialFoodTimer) clearTimeout(specialFoodTimer);
    buildAllFloors();
    stockAllFloors();
    drawBoard();
    drawSnake();
    drawFood();
    drawScore();
    drawFloorIndicator();
}

// Moves the snake up or down a floor. The x/y position stays the
// same — only the active wall layout and food change.
function changeFloor(delta) {
    if (gameOver) return;

    const targetFloor = currentFloor + delta;
    if (targetFloor < 0 || targetFloor >= totalFloors) {
        return; // already at the top or bottom floor
    }

    // Moving floors is blocked if a wall occupies this exact spot
    // on the destination floor — otherwise the snake would land
    // directly inside a wall.
    const destWalls = floorWalls[targetFloor];
    const headKey = `${snake[0].x},${snake[0].y}`;
    if (destWalls && destWalls.has(headKey)) {
        return;
    }

    currentFloor = targetFloor;

    // Cancel any special food countdown from the previous floor
    specialFoodActive = false;
    specialFood = null;
    if (specialFoodTimer) clearTimeout(specialFoodTimer);

    drawBoard();
    drawSnake();
    drawFood();
    drawFloorIndicator();
}

function drawFloorIndicator() {
    const el = document.getElementById('floor');
    if (el) el.textContent = currentFloor + 1;
}

window.addEventListener('keydown', (event) => {
    if (gameOver) {
        if (event.key === ' ' || event.key === 'Space') {
            event.preventDefault();
            restartGame();
        }
        return;
    }

    const key = event.key;

    // Floor switching: Space = up a floor, Ctrl = down a floor
    if (key === ' ' || key === 'Space') {
        event.preventDefault();
        changeFloor(1);
        return;
    }
    if (key === 'Control') {
        event.preventDefault();
        changeFloor(-1);
        return;
    }

    if (key === 'ArrowUp' && direction.y === 0) {
        nextDirection = { x: 0, y: -1 };
    } else if (key === 'ArrowDown' && direction.y === 0) {
        nextDirection = { x: 0, y: 1 };
    } else if (key === 'ArrowLeft' && direction.x === 0) {
        nextDirection = { x: -1, y: 0 };
    } else if (key === 'ArrowRight' && direction.x === 0) {
        nextDirection = { x: 1, y: 0 };
    }
});

// Difficulty speeds 
const difficultySettings = {
    easy:   150,
    medium: 100,
    hard:    60
};

// called by the menu's Start button
function startGame(difficulty) {
    // 1. Set speed based on chosen difficulty
    speed = difficultySettings[difficulty] || 100;

    // 2. Hide the menu, show the game
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameShell').style.display = 'block';

    // 3. Build wall layouts for every floor, then place food on each one
    currentFloor = 0;
    buildAllFloors();
    stockAllFloors();

    // 4. Draw the initial board and begin the loop
    drawBoard();
    drawSnake();
    drawScore();
    drawFloorIndicator();
    if (foodLoaded && foodImage.complete) {
        drawFood();
    }
    setInterval(update, speed);
}