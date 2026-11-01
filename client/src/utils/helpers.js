/**
 * Calculate the minimum number of transactions to settle all debts.
 */
export function calculateSettlements(players) {
  // Step 1: Calculate how much each player won or lost, in whole cents so
  // rounding never leaves a 0.01 transfer behind
  const balances = [];
  for (let i = 0; i < players.length; i++) {
    const net = Math.round((players[i].cashOut - players[i].totalIn) * 100);
    balances.push({ name: players[i].name, net: net });
  }

  // Step 2: Split into people who owe money and people who are owed money
  const debtors = [];
  const creditors = [];

  for (let i = 0; i < balances.length; i++) {
    if (balances[i].net < 0) {
      debtors.push({ name: balances[i].name, amount: Math.abs(balances[i].net) });
    } else if (balances[i].net > 0) {
      creditors.push({ name: balances[i].name, amount: balances[i].net });
    }
  }

  // Sort biggest first
  debtors.sort(function(a, b) { return b.amount - a.amount; });
  creditors.sort(function(a, b) { return b.amount - a.amount; });

  // Step 3: Match debtors with creditors
  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);

    if (amount > 0) {
      transactions.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: amount / 100,
      });
    }

    debtors[i].amount = debtors[i].amount - amount;
    creditors[j].amount = creditors[j].amount - amount;

    if (debtors[i].amount <= 0) i = i + 1;
    if (creditors[j].amount <= 0) j = j + 1;
  }

  return transactions;
}

/**
 * Format a currency amount with the appropriate symbol.
 */
export function formatCurrency(amount, currency) {
  const abs = Math.abs(amount);
  const formatted = abs % 1 === 0 ? abs.toString() : abs.toFixed(2);

  switch (currency) {
    case '$':
      return `$${formatted}`;
    case '€':
      return `€${formatted}`;
    case '₪':
    default:
      return `₪${formatted}`;
  }
}

/**
 * Generate initials from a player name.
 */
export function getInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const CHIP_COLORS = ['var(--chip-coral)', 'var(--chip-blue)', 'var(--chip-mint)', 'var(--chip-yellow)', 'var(--chip-purple)', 'var(--chip-orange)'];

/**
 * Each player's avatar is a poker chip; the color comes from their name,
 * so a player has the same chip on every screen and every phone.
 */
export function chipStyle(name) {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { '--chip': CHIP_COLORS[hash % CHIP_COLORS.length] };
}

/**
 * Generate a unique ID in MongoDB ObjectId format (24 hex chars), so a player
 * keeps the same id on every phone and in the database.
 */
export function generateId() {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  let rest = '';
  for (let i = 0; i < 16; i++) rest += Math.floor(Math.random() * 16).toString(16);
  return time + rest;
}

/**
 * Round a money amount to cents.
 */
export function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Round a number to the nearest multiple of 50.
 */
export function roundToNearest50(value) {
  return Math.round(value / 50) * 50;
}
// A name with an @ is an email address that ended up as the name (old Google sign-ins)
export function needsRealName(user) {
  return !!user && (!user.name || user.name.includes('@'));
}
