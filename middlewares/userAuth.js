import User from "../models/userModel.js"
const isLogin = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (!user) {
        delete req.session.user;
        return res.redirect('/login');
      }
      if (!user.is_active) {
        delete req.session.user;
        return res.redirect('/login?blocked=true');
      }
      return next();
    } else {
      return res.redirect('/login');
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const isLogout = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && !user.is_active) {
        delete req.session.user;
        return next();
      }
      return res.redirect('/home');
    }
    next();
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const isBlocked = async (req, res, next) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const user = await User.findById(req.session.user);
    if (!user) return res.redirect('/logout');
    if (!user.is_active) {
      delete req.session.user;
      return res.redirect('/login?blocked=true');
    }
    next();
  } catch (error) {
    console.error("Error checking user block status:", error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const preventUserAccessForAdmin = (req, res, next) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  next();
};

export default {
  isLogin,
  isLogout,
  preventUserAccessForAdmin,
  isBlocked
};