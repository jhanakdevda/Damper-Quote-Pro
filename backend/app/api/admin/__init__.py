from fastapi import APIRouter
from app.api.admin.size_limits import router as size_limits_router
from app.api.admin.scaling_rules import router as scaling_rules_router
from app.api.admin.verified_sizes import router as verified_sizes_router
from app.api.admin.calibration import router as calibration_router
from app.api.admin.multi_blade_admin import router as multi_blade_router

router = APIRouter(prefix="/admin", tags=["Admin"])
router.include_router(size_limits_router)
router.include_router(scaling_rules_router)
router.include_router(verified_sizes_router)
router.include_router(calibration_router)
router.include_router(multi_blade_router)
