import pandas as pd
import numpy as np
import os

# ─────────────────────────────────────────────
# Column groups matching the dataset pipeline:
# Inputs → Chemistry → Phases → Properties
# ─────────────────────────────────────────────
INPUT_COLS    = ['KS1295[%]', '6082[%]', '2024[%]', 'bat-box[%]', '3003[%]', '4032[%]']
ELEMENT_COLS  = ['Al', 'Si', 'Cu', 'Ni', 'Mg', 'Mn', 'Fe', 'Cr', 'Ti', 'Zr', 'V', 'Zn']
PHASE_COLS    = ['Vf_FCC_A1', 'Vf_DIAMOND_A4', 'Vf_AL15SI2M4', 'Vf_AL3X', 'Vf_AL6MN',
                 'Vf_MG2ZN3', 'Vf_AL3NI2', 'Vf_AL3NI_D011', 'Vf_AL7CU4NI', 'Vf_AL2CU_C16',
                 'Vf_Q_ALCUMGSI', 'Vf_AL7CU2FE', 'Vf_MG2SI_C1', 'Vf_AL9FE2SI2', 'Vf_AL18FE2MG7SI10']
MECH_COLS     = ['YS(MPa)', 'hardness(Vickers)', 'CSC']
THERMO_COLS   = ['CTEvol(1/K)(20.0-300.0°C)', 'Density(g/cm3)', 'El.conductivity(S/m)',
                 'El. resistivity(ohm m)', 'heat capacity(J/(mol K))',
                 'Therm.conductivity(W/(mK))', 'Therm. diffusivity(m2/s)',
                 'Therm.resistivity(mK/W)',
                 'Linear thermal expansion (1/K)(20.0-300.0°C)',
                 'Technical thermal expansion (1/K)(20.0-300.0°C)',
                 'Volume(m3/mol)']


class DataHelper:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df: pd.DataFrame | None = None
        # column name lists resolved after loading
        self.numerical_cols: list[str] = []
        self.categorical_cols: list[str] = []

    # ──────────────────────────────────────────
    # Loading
    # ──────────────────────────────────────────
    def load_data(self) -> None:
        """
        Eagerly load the dataset on Flask startup.
        - Detects encoding automatically (UTF-8 → latin1 fallback)
        - Drops unnamed/empty trailing columns (common in Excel-exported TSVs)
        - Casts numeric columns back to float so select_dtypes works correctly
        - Does NOT replace NaN with None here; that conversion is done at
          serialisation time to avoid dtype corruption.
        """
        if self.df is not None:   # already loaded
            return

        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Dataset not found at {self.file_path}")

        sep = '\t' if self.file_path.endswith('.txt') else ','

        # --- encoding detection ---
        try:
            raw = pd.read_csv(self.file_path, sep=sep, encoding='utf-8')
        except UnicodeDecodeError:
            print("UTF-8 failed – retrying with latin1 encoding…")
            raw = pd.read_csv(self.file_path, sep=sep, encoding='latin1')

        # --- drop unnamed trailing columns (Unnamed: X) ---
        raw = raw.loc[:, ~raw.columns.str.startswith('Unnamed')]

        # --- infer / coerce numeric columns --
        # pd.read_csv with latin1 may import some columns as object; fix them.
        for col in raw.columns:
            if raw[col].dtype == object:
                coerced = pd.to_numeric(raw[col], errors='coerce')
                # Only replace if >50% of non-null values are actually numeric
                if coerced.notna().sum() / max(len(raw), 1) > 0.5:
                    raw[col] = coerced

        self.df = raw
        self.numerical_cols   = self.df.select_dtypes(include='number').columns.tolist()
        self.categorical_cols = self.df.select_dtypes(exclude='number').columns.tolist()

        print(f"Loaded {len(self.df)} rows × {len(self.df.columns)} columns")
        print(f"  Numerical : {len(self.numerical_cols)} | Categorical: {len(self.categorical_cols)}")

    # ──────────────────────────────────────────
    # Helper: safe NaN → None serialisation
    # ──────────────────────────────────────────
    def _to_records(self, frame: pd.DataFrame) -> list[dict]:
        """Convert dataframe to JSON-safe records replacing NaN with None."""
        return [
            {k: (None if isinstance(v, float) and np.isnan(v) else v)
             for k, v in row.items()}
            for row in frame.to_dict(orient='records')
        ]

    # ──────────────────────────────────────────
    # Public API helpers
    # ──────────────────────────────────────────
    def get_sample(self, n: int | None = None) -> list[dict]:
        """Return all rows or a reproducible random sample of n rows."""
        self.load_data()
        subset = self.df if (n is None or len(self.df) <= n) else self.df.sample(n=n, random_state=42)
        return self._to_records(subset)

    def get_parallel_data(self, n: int = 2000, cols: str | None = None) -> list[dict]:
        """
        Return a small sample of pipeline columns for the Parallel Coordinates chart.
        If cols is provided (comma-separated string), use those; otherwise auto-select
        a representative subset spanning Inputs → Elements → Phases → Properties.
        """
        self.load_data()

        if cols:
            # Use caller-specified columns (filter to those that actually exist)
            selected = [c.strip() for c in cols.split(',') if c.strip() in self.df.columns]
        else:
            # Auto-select: up to 4 from each pipeline stage, max 20 total
            def pick(candidates, limit=4):
                return [c for c in candidates if c in self.df.columns][:limit]

            selected = (
                pick(INPUT_COLS, 4) +
                pick(ELEMENT_COLS, 4) +
                pick(PHASE_COLS, 4) +
                pick(MECH_COLS, 3) +
                pick(THERMO_COLS, 3)
            )

        if not selected:
            selected = self.numerical_cols[:20]

        subset = self.df[selected].dropna(how='all')
        if len(subset) > n:
            subset = subset.sample(n=n, random_state=42)
        return self._to_records(subset)

    def get_two_col_sample(self, x: str, y: str, n: int = 5000) -> list[dict]:
        """
        Return only two columns for the Scatter Plot, with NaN rows dropped.
        Sending only 2 columns × n rows keeps the payload tiny.
        """
        self.load_data()
        for col in (x, y):
            if col not in self.df.columns:
                raise ValueError(f"Column '{col}' not found in dataset")
        subset = self.df[[x, y]].dropna()
        if len(subset) > n:
            subset = subset.sample(n=n, random_state=42)
        return self._to_records(subset)

    def get_three_col_sample(self, x: str, y: str, z: str, n: int = 5000) -> list[dict]:
        """
        Return only three columns for the Bubble Chart, with NaN rows dropped.
        Sending only 3 columns × n rows keeps the payload tiny.
        """
        self.load_data()
        for col in (x, y, z):
            if col not in self.df.columns:
                raise ValueError(f"Column '{col}' not found in dataset")
        subset = self.df[[x, y, z]].dropna()
        if len(subset) > n:
            subset = subset.sample(n=n, random_state=42)
        return self._to_records(subset)


    def get_averages(self) -> dict:
        """
        Return the mean of every numerical column.
        Result is a single dict – suitable for Bar Chart and Radar Chart.
        """
        self.load_data()
        means = (
            self.df[self.numerical_cols]
                .mean(numeric_only=True)
                .to_dict()
        )
        # Replace NaN means (empty columns) with None
        return {k: (None if isinstance(v, float) and np.isnan(v) else v)
                for k, v in means.items()}

    def get_composition_grouped(self) -> list[dict]:
        """
        Group rows by their dominant scrap input (alloy with highest %) and
        return the mean element composition per group.
        Used by the Bar Chart to answer 'What elements are in each alloy mix?'
        """
        self.load_data()
        available_inputs   = [c for c in INPUT_COLS   if c in self.df.columns]
        available_elements = [c for c in ELEMENT_COLS if c in self.df.columns]

        if not available_inputs or not available_elements:
            return self._to_records(self.df[available_elements].head())

        # Build a local Series without touching self.df
        dominant = self.df[available_inputs].idxmax(axis=1)
        grouped = (
            self.df[available_elements]
                .assign(alloy_group=dominant)
                .groupby('alloy_group')[available_elements]
                .mean()
                .reset_index()
        )
        return self._to_records(grouped)

    def get_phase_grouped(self) -> list[dict]:
        """
        Return mean phase volume fractions grouped by dominant input alloy.
        Used by the Bar Chart to answer 'What crystal structure appears?'
        """
        self.load_data()
        available_inputs = [c for c in INPUT_COLS  if c in self.df.columns]
        available_phases = [c for c in PHASE_COLS  if c in self.df.columns]

        if not available_inputs or not available_phases:
            return []

        dominant = self.df[available_inputs].idxmax(axis=1)
        grouped = (
            self.df[available_phases]
                .assign(alloy_group=dominant)
                .groupby('alloy_group')[available_phases]
                .mean()
                .reset_index()
        )
        return self._to_records(grouped)

    def get_properties_grouped(self) -> list[dict]:
        """
        Return mean mechanical + thermophysical properties per dominant input alloy.
        Used by the Radar Chart and Property overview.
        """
        self.load_data()
        available_inputs = [c for c in INPUT_COLS if c in self.df.columns]
        prop_cols = [c for c in MECH_COLS + THERMO_COLS if c in self.df.columns]

        if not available_inputs or not prop_cols:
            return self._to_records(self.df[prop_cols].mean().to_frame().T)

        # Use a local Series — never mutate self.df
        dominant = self.df[available_inputs].idxmax(axis=1)
        grouped = (
            self.df[prop_cols]
                .assign(alloy_group=dominant)
                .groupby('alloy_group')[prop_cols]
                .mean()
                .reset_index()
        )
        return self._to_records(grouped)

    def get_metadata(self) -> dict:
        """Return column catalogue and row count for frontend awareness."""
        self.load_data()
        available = lambda cols: [c for c in cols if c in self.df.columns]
        return {
            "rows": len(self.df),
            "columns": len(self.df.columns),
            "inputs":     available(INPUT_COLS),
            "elements":   available(ELEMENT_COLS),
            "phases":     available(PHASE_COLS),
            "mechanical": available(MECH_COLS),
            "thermo":     available(THERMO_COLS),
            "numerical":  self.numerical_cols,
            "categorical": self.categorical_cols,
        }
