const memberService = require("../services/memberService");

exports.getMembersDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = await memberService.getMembersDashboard(userId);

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

exports.createMember = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, notes } = req.body;

    const member = await memberService.createMember({
      userId,
      name,
      notes,
    });

    return res.status(201).json({
      message: "Member created successfully",
      member,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateMember = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const memberId = req.params.id;
    const { name, notes } = req.body;

    const member = await memberService.updateMember({
      userId,
      memberId,
      name,
      notes,
    });

    return res.status(200).json({
      message: "Member updated successfully",
      member,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMember = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const memberId = req.params.id;

    await memberService.deleteMember({
      userId,
      memberId,
    });

    return res.status(200).json({
      message: "Member deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};