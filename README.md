# Drinking Game

## Setup

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm install --prefix frontend
```

## Testing

Run frontend tests with:

```bash
npm test --prefix frontend
```

### Cheers or Tears Simulation

The repository includes a simple simulation of the Split or Steal drinking game
with adaptive penalties. Run it using Node:

```bash
node server/cheersOrTears.js [rounds]
```

`rounds` is optional and defaults to 20. The script prints the current
penalties before each round, the choices made, and the resulting number of sips
for each player.
