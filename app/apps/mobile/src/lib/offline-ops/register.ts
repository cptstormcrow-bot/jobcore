// Drain must never see an unregistered op (it would markFailed permanent), so every handler module loads here.
import './tech';
import './admin-jobs';
import './admin-people';
import './admin-finance';
