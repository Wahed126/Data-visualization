from flask import Blueprint, jsonify, request
from helpers import DataHelper
import os

api_bp = Blueprint('api', __name__)

# ──────────────────────────────────────────────────────────────────
# Dataset — loaded once on Flask startup
# ──────────────────────────────────────────────────────────────────
DATASET_PATH = os.path.join(os.path.dirname(__file__), 'data', 'data.txt')
data_helper = DataHelper(DATASET_PATH)
data_helper.load_data()


def error_response(message: str, code: int = 500):
    return jsonify({"error": message}), code


# ──────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/status', methods=['GET'])
def get_status():
    """Health check — returns row/column counts and the column catalogue."""
    try:
        return jsonify(data_helper.get_metadata())
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Chart 1 — Parallel Coordinates
# Returns a manageable sample of selected pipeline columns.
# ?cols=col1,col2,...  (optional; defaults to a representative pipeline subset)
# ?n=<int>            (optional; defaults to 2000 rows)
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/chart/parallel', methods=['GET'])
def chart_parallel():
    try:
        n    = int(request.args.get('n', 2000))
        cols = request.args.get('cols')
        return jsonify(data_helper.get_parallel_data(n=n, cols=cols))
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Chart 2 — Bar Chart (element composition grouped by alloy)
# No query params needed — always aggregated.
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/chart/bar', methods=['GET'])
def chart_bar():
    try:
        return jsonify(data_helper.get_composition_grouped())
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Chart 3 — Radar Chart (properties grouped by alloy)
# No query params needed — always aggregated.
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/chart/radar', methods=['GET'])
def chart_radar():
    try:
        return jsonify(data_helper.get_properties_grouped())
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Chart 4 — Scatter Plot
# Returns only the two requested columns + a row sample.
# ?x=<col>  (required)  ?y=<col>  (required)  ?n=<int> (default 5000)
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/chart/scatter', methods=['GET'])
def chart_scatter():
    try:
        x = request.args.get('x')
        y = request.args.get('y')
        n = int(request.args.get('n', 5000))
        if not x or not y:
            return error_response("Query params 'x' and 'y' are required", 400)
        return jsonify(data_helper.get_two_col_sample(x, y, n))
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Chart 5 — Bubble Chart
# Returns only the three requested columns + a row sample.
# ?x=<col>  ?y=<col>  ?z=<col>  (all required)  ?n=<int> (default 5000)
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/chart/bubble', methods=['GET'])
def chart_bubble():
    try:
        x = request.args.get('x')
        y = request.args.get('y')
        z = request.args.get('z')
        n = int(request.args.get('n', 5000))
        if not x or not y or not z:
            return error_response("Query params 'x', 'y', and 'z' are required", 400)
        return jsonify(data_helper.get_three_col_sample(x, y, z, n))
    except Exception as e:
        return error_response(str(e))


@api_bp.route('/chart/heatmap', methods=['GET'])
def chart_heatmap():
    """
    Returns Pearson correlation matrix (inputs × outputs).
    Used by the Correlation Heatmap view.
    """
    try:
        return jsonify(data_helper.get_correlation_matrix())
    except Exception as e:
        return error_response(str(e))


@api_bp.route('/chart/sensitivity', methods=['GET'])
def chart_sensitivity():
    """
    Returns Spearman correlation of all inputs vs a specific target output.
    Used by the Sensitivity Bar Chart.
    """
    try:
        target = request.args.get('target')
        if not target:
            return error_response("Query param 'target' is required", 400)
        return jsonify(data_helper.get_sensitivity(target))
    except Exception as e:
        return error_response(str(e))


# ──────────────────────────────────────────────────────────────────
# Columns list — used by frontend dropdowns
# ──────────────────────────────────────────────────────────────────
@api_bp.route('/columns', methods=['GET'])
def get_columns():
    """Return the list of numerical columns for frontend dropdown population."""
    try:
        return jsonify({
            "numerical":   data_helper.numerical_cols,
            "categorical": data_helper.categorical_cols,
        })
    except Exception as e:
        return error_response(str(e))
