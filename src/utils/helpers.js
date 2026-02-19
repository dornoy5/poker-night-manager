/**
 * Calculate the minimum number of transactions to settle all debts.
 */
export function calculateSettlements(players) {
  // Step 1: Calculate how much each player won or lost
  const balances = [];
  for (let i = 0; i < players.length; i++) {
    const net = players[i].cashOut - players[i].totalIn;
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
        amount: Math.round(amount * 100) / 100,
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

/**
 * Generate a unique ID.
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Round a number to the nearest multiple of 50.
 */
export function roundToNearest50(value) {
  return Math.round(value / 50) * 50;
}