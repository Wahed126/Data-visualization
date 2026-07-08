// Principal Component Analysis on standardized features.
// The feature count is small (<= ~67 columns), so an explicit covariance
// matrix plus power iteration with deflation is fast enough to run in the
// browser. Two entry points are provided:
//   - computePCA: synchronous, for arrays of row objects (small samples)
//   - fitPCAFromTable: asynchronous + chunked, streams over the FULL columnar
//     table (~325k rows) without blocking the UI thread.

// Standardize a feature matrix column-wise (z-scores). Non-finite entries
// are imputed with the column mean so single missing values do not drop rows.
const standardize = (rows, features) => {
  const n = rows.length;
  const d = features.length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  const counts = new Array(d).fill(0);

  features.forEach((feature, j) => {
    rows.forEach((row) => {
      const value = row[feature];
      if (Number.isFinite(value)) {
        means[j] += value;
        counts[j] += 1;
      }
    });
    means[j] = counts[j] > 0 ? means[j] / counts[j] : 0;
  });

  features.forEach((feature, j) => {
    rows.forEach((row) => {
      const value = row[feature];
      if (Number.isFinite(value)) {
        const diff = value - means[j];
        stds[j] += diff * diff;
      }
    });
    stds[j] = counts[j] > 1 ? Math.sqrt(stds[j] / (counts[j] - 1)) : 0;
  });

  const matrix = new Float64Array(n * d);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      const value = rows[i][features[j]];
      const centered = Number.isFinite(value) ? value - means[j] : 0;
      matrix[i * d + j] = stds[j] > 1e-12 ? centered / stds[j] : 0;
    }
  }

  return { matrix, means, stds };
};

// Covariance (correlation) matrix of the standardized data: (Z^T Z) / (n - 1)
const covarianceMatrix = (matrix, n, d) => {
  const cov = new Float64Array(d * d);
  for (let i = 0; i < n; i++) {
    const rowOffset = i * d;
    for (let a = 0; a < d; a++) {
      const va = matrix[rowOffset + a];
      if (va === 0) continue;
      for (let b = a; b < d; b++) {
        cov[a * d + b] += va * matrix[rowOffset + b];
      }
    }
  }
  const denom = Math.max(n - 1, 1);
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a * d + b] /= denom;
      cov[b * d + a] = cov[a * d + b];
    }
  }
  return cov;
};

// Leading eigenvector of a symmetric matrix via power iteration.
const powerIteration = (cov, d, iterations = 300) => {
  let vector = new Float64Array(d);
  // Deterministic pseudo-random start so results are reproducible
  for (let j = 0; j < d; j++) {
    vector[j] = Math.sin(j * 12.9898 + 78.233) * 0.5 + 0.5;
  }

  let eigenvalue = 0;
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Float64Array(d);
    for (let a = 0; a < d; a++) {
      let sum = 0;
      const offset = a * d;
      for (let b = 0; b < d; b++) {
        sum += cov[offset + b] * vector[b];
      }
      next[a] = sum;
    }
    let norm = 0;
    for (let a = 0; a < d; a++) norm += next[a] * next[a];
    norm = Math.sqrt(norm);
    if (norm < 1e-15) break;
    for (let a = 0; a < d; a++) next[a] /= norm;

    let delta = 0;
    for (let a = 0; a < d; a++) delta += Math.abs(next[a] - vector[a]);
    vector = next;
    eigenvalue = norm;
    if (delta < 1e-10) break;
  }

  return { vector, eigenvalue };
};

// Remove the found component from the covariance matrix (Hotelling deflation)
const deflate = (cov, d, vector, eigenvalue) => {
  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) {
      cov[a * d + b] -= eigenvalue * vector[a] * vector[b];
    }
  }
};

/**
 * Compute PCA scores and loadings for the given rows and feature columns.
 *
 * @param {Object[]} rows - data rows (objects keyed by column name)
 * @param {string[]} features - numeric column names to include
 * @param {number} componentCount - number of principal components
 * @returns {{ scores: number[][], loadings: number[][], explainedVariance: number[], features: string[] }}
 */
export const computePCA = (rows, features, componentCount = 2) => {
  // Drop constant / fully missing columns (their std is 0)
  const { stds } = standardize(rows, features);
  const usableFeatures = features.filter((_, j) => stds[j] > 1e-12);

  if (usableFeatures.length < componentCount || rows.length < 3) {
    return { scores: [], loadings: [], explainedVariance: [], features: [] };
  }

  // Re-standardize with only usable features for a clean matrix
  const clean = standardize(rows, usableFeatures);
  const n = rows.length;
  const d = usableFeatures.length;
  const cov = covarianceMatrix(clean.matrix, n, d);

  // Total variance of a correlation matrix equals its trace
  let totalVariance = 0;
  for (let a = 0; a < d; a++) totalVariance += cov[a * d + a];

  const loadings = [];
  const explainedVariance = [];
  for (let c = 0; c < componentCount; c++) {
    const { vector, eigenvalue } = powerIteration(cov, d);
    loadings.push(Array.from(vector));
    explainedVariance.push(totalVariance > 0 ? eigenvalue / totalVariance : 0);
    deflate(cov, d, vector, eigenvalue);
  }

  // Project rows onto the components
  const scores = new Array(n);
  for (let i = 0; i < n; i++) {
    const rowOffset = i * d;
    const score = new Array(componentCount).fill(0);
    for (let c = 0; c < componentCount; c++) {
      const loading = loadings[c];
      let sum = 0;
      for (let j = 0; j < d; j++) {
        sum += clean.matrix[rowOffset + j] * loading[j];
      }
      score[c] = sum;
    }
    scores[i] = score;
  }

  return { scores, loadings, explainedVariance, features: usableFeatures };
};

const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Fit PCA on the FULL columnar table (Float32Array matrix) without blocking
 * the UI: the two data passes (moments, covariance) run in row chunks with a
 * yield between chunks. Returns loadings/means/stds so callers can project
 * any row of the table (or a display sample) onto the components.
 *
 * @param {{columns: string[], matrix: Float32Array, rowCount: number}} table
 * @param {string[]} featureNames - columns to include
 * @param {number} componentCount
 * @param {(fraction: number) => void} [onProgress]
 * @param {() => boolean} [shouldAbort] - checked between chunks; returns null when aborted
 */
export const fitPCAFromTable = async (table, featureNames, componentCount = 2, onProgress, shouldAbort) => {
  const { columns, matrix, rowCount } = table;
  const columnCount = columns.length;
  const candidateIdx = featureNames
    .map((name) => columns.indexOf(name))
    .filter((index) => index >= 0);
  const n = rowCount;
  const CHUNK = 20000;

  // Pass 1: means and stds over finite values
  let d = candidateIdx.length;
  const sums = new Float64Array(d);
  const sqSums = new Float64Array(d);
  const counts = new Float64Array(d);
  for (let start = 0; start < n; start += CHUNK) {
    if (shouldAbort?.()) return null;
    const end = Math.min(start + CHUNK, n);
    for (let i = start; i < end; i++) {
      const offset = i * columnCount;
      for (let j = 0; j < d; j++) {
        const value = matrix[offset + candidateIdx[j]];
        if (Number.isFinite(value)) {
          sums[j] += value;
          sqSums[j] += value * value;
          counts[j] += 1;
        }
      }
    }
    onProgress?.(0.4 * (end / n));
    await yieldToEventLoop();
  }
  const meansAll = new Float64Array(d);
  const stdsAll = new Float64Array(d);
  for (let j = 0; j < d; j++) {
    const c = counts[j];
    meansAll[j] = c > 0 ? sums[j] / c : 0;
    const variance = c > 1 ? (sqSums[j] - c * meansAll[j] * meansAll[j]) / (c - 1) : 0;
    stdsAll[j] = variance > 0 ? Math.sqrt(variance) : 0;
  }

  // Drop constant / fully-missing columns
  const usable = [];
  for (let j = 0; j < d; j++) {
    if (stdsAll[j] > 1e-12) usable.push(j);
  }
  const featureIdx = usable.map((j) => candidateIdx[j]);
  const means = usable.map((j) => meansAll[j]);
  const stds = usable.map((j) => stdsAll[j]);
  d = featureIdx.length;
  if (d < componentCount) {
    return { loadings: [], explainedVariance: [], features: [], featureIdx: [], means: [], stds: [] };
  }

  // Pass 2: covariance accumulation on standardized values
  // (non-finite entries standardize to 0 = mean imputation)
  const cov = new Float64Array(d * d);
  const z = new Float64Array(d);
  for (let start = 0; start < n; start += CHUNK) {
    if (shouldAbort?.()) return null;
    const end = Math.min(start + CHUNK, n);
    for (let i = start; i < end; i++) {
      const offset = i * columnCount;
      for (let j = 0; j < d; j++) {
        const value = matrix[offset + featureIdx[j]];
        z[j] = Number.isFinite(value) ? (value - means[j]) / stds[j] : 0;
      }
      for (let a = 0; a < d; a++) {
        const za = z[a];
        if (za === 0) continue;
        const rowOffset = a * d;
        for (let b = a; b < d; b++) {
          cov[rowOffset + b] += za * z[b];
        }
      }
    }
    onProgress?.(0.4 + 0.6 * (end / n));
    await yieldToEventLoop();
  }
  const denom = Math.max(n - 1, 1);
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a * d + b] /= denom;
      cov[b * d + a] = cov[a * d + b];
    }
  }

  let totalVariance = 0;
  for (let a = 0; a < d; a++) totalVariance += cov[a * d + a];

  const loadings = [];
  const explainedVariance = [];
  for (let c = 0; c < componentCount; c++) {
    const { vector, eigenvalue } = powerIteration(cov, d);
    loadings.push(Array.from(vector));
    explainedVariance.push(totalVariance > 0 ? eigenvalue / totalVariance : 0);
    deflate(cov, d, vector, eigenvalue);
  }

  return {
    loadings,
    explainedVariance,
    features: featureIdx.map((index) => columns[index]),
    featureIdx,
    means,
    stds,
  };
};

/**
 * Project row objects (e.g. the display sample) onto a fitted PCA model.
 */
export const projectRows = (rows, model) => {
  const { features, means, stds, loadings } = model;
  const d = features.length;
  const k = loadings.length;
  return rows.map((row) => {
    const score = new Array(k).fill(0);
    for (let j = 0; j < d; j++) {
      const value = row[features[j]];
      const z = Number.isFinite(value) ? (value - means[j]) / stds[j] : 0;
      if (z === 0) continue;
      for (let c = 0; c < k; c++) {
        score[c] += z * loadings[c][j];
      }
    }
    return score;
  });
};
