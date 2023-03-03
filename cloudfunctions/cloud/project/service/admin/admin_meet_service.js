/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-12-08 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const MeetService = require('../meet_service.js');
const dataUtil = require('../../../framework/utils/data_util.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const util = require('../../../framework/utils/util.js');
const cloudUtil = require('../../../framework/cloud/cloud_util.js');
const cloudBase = require('../../../framework/cloud/cloud_base.js');

const MeetModel = require('../../model/meet_model.js');
const JoinModel = require('../../model/join_model.js');
const DayModel = require('../../model/day_model.js');
const config = require('../../../config/config.js');

class AdminMeetService extends BaseAdminService {

	/** 预约数据列表 */
	async getDayList(meetId, start, end) {
		let where = {
			DAY_MEET_ID: meetId,
			day: ['between', start, end]
		}
		let orderBy = {
			day: 'asc'
		}
		return await DayModel.getAllBig(where, 'day,times,dayDesc', orderBy);
	}

	// 按项目统计人数
	async statJoinCntByMeet(meetId) {
		let today = timeUtil.time('Y-M-D');
		let where = {
			day: ['>=', today],
			DAY_MEET_ID: meetId
		}

		let meetService = new MeetService();
		let list = await DayModel.getAllBig(where, 'DAY_MEET_ID,times', {}, 1000);
		for (let k in list) {
			let meetId = list[k].DAY_MEET_ID;
			let times = list[k].times;

			for (let j in times) {
				let timeMark = times[j].mark;
				meetService.statJoinCnt(meetId, timeMark);
			}
		}
	}

	/** 自助签到码 */
	async genSelfCheckinQr(page, timeMark) {
		//生成小程序qr buffer
		let cloud = cloudBase.getCloud();

		if (page.startsWith('/projects/')) page = page.replace('/projects/', 'projects/');

		let result = await cloud.openapi.wxacode.getUnlimited({
			scene: timeMark,
			width: 280,
			page
		});

		let upload = await cloud.uploadFile({
			cloudPath: config.MEET_TIMEMARK_QR_PATH + timeMark + '.png',
			fileContent: result.buffer,
		});

		if (!upload || !upload.fileID) return;

		return upload.fileID;
	}

	/** 管理员按钮核销 */
	async checkinJoin(joinId, flag) {
		let join = await JoinModel.getOne(joinId);

		if (!join)
			this.AppError('没有该用户的预约记录，核销失败');

		if (join.JOIN_STATUS != JoinModel.STATUS.SUCC)
			this.AppError('该用户未预约成功，核销失败');


		let data = {
			JOIN_IS_CHECKIN: flag
		};
		await JoinModel.edit(joinId, data);
	}

	/** 管理员扫码核销 */
	async scanJoin(meetId, code) {
		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_CODE: code
		}
		let join = await JoinModel.getOne(where);

		if (!join)
			this.AppError('没有该用户的预约记录，核销失败');

		if (join.JOIN_STATUS != JoinModel.STATUS.SUCC)
			this.AppError('该用户未预约成功，核销失败');

		if (join.JOIN_IS_CHECKIN == 1)
			this.AppError('该用户已签到/核销，无须重复核销');

		let data = {
			JOIN_IS_CHECKIN: 1
		};
		await JoinModel.edit(where, data);
	}

	/**
	 * 判断本日是否有预约记录
	 * @param {*} daySet daysSet的节点
	 */
	checkHasJoinCnt(times) {
		if (!times) return false;
		for (let k in times) {
			if (times[k].stat.succCnt) return true;
		}
		return false;
	}

	// 判断含有预约的日期
	getCanModifyDaysSet(daysSet) {
		let now = timeUtil.time('Y-M-D');

		for (let k in daysSet) {
			if (daysSet[k].day < now) continue;
			daysSet[k].hasJoin = this.checkHasJoinCnt(daysSet[k].times);
		}

		return daysSet;
	}

	/** 取消某个时间段的所有预约记录 */
	async cancelJoinByTimeMark(admin, meetId, timeMark, reason) {
		let where = {
			JOIN_MEET_TIME_MARK: timeMark,
			JOIN_MEET_ID: meetId,
			JOIN_STATUS: JoinModel.STATUS.SUCC
		};

		let data = {
			JOIN_STATUS: JoinModel.STATUS.ADMIN_CANCEL,

			JOIN_REASON: dataUtil.fmtText(reason),

			JOIN_EDIT_ADMIN_ID: admin._id,
			JOIN_EDIT_ADMIN_NAME: admin.ADMIN_NAME,
			JOIN_EDIT_ADMIN_TIME: this._timestamp

		}


		// 更改数据库
		await JoinModel.edit(where, data);

		// 重新统计
		let meetService = new MeetService();
		await meetService.statJoinCnt(meetId, timeMark);

		let whereMeet = {
			_id: meetId
		}
		let meet = await meetService.getMeetOneDay(meetId, meetService.getDayByTimeMark(timeMark), whereMeet, 'MEET_ID');

		if (!meet) this.AppError('找不到该记录');
		let timeSet = meetService.getTimeSetByTimeMark(meet, timeMark);
		return timeSet.stat;

	}


	/**添加 */
	async insertMeet(adminId, {
		title,
		order,
		typeId,
		typeName,
		daysSet,
		isShowLimit,
		formSet,
	}) {

		// 重复性判断
		let where = {
			MEET_TITLE: title,
		}
		if (await MeetModel.count(where))
			this.AppError('该标题已经存在');

		// 赋值 
		let data = {};
		data.MEET_TITLE = title;
		data.MEET_ORDER = order;
		data.MEET_TYPE_ID = typeId;
		data.MEET_TYPE_NAME = typeName;

		data.MEET_IS_SHOW_LIMIT = isShowLimit;

		data.MEET_FORM_SET = formSet;

		data.MEET_ADMIN_ID = adminId;

		data.MEET_DAYS = dataUtil.getArrByKey(daysSet, 'day');

		let id = await MeetModel.insert(data);

		await this._editDays(id, timeUtil.time('Y-M-D'), daysSet);

		return {
			id
		};
	}

	/**删除数据 */
	async delMeet(id) {
		let where = {
			_id: id
		}

		// 取出图片数据
		let meet = await MeetModel.getOne(where, 'MEET_PIC');
		if (!meet) return;

		await MeetModel.del(where);

		let whereDay = {
			DAY_MEET_ID: id
		}
		DayModel.del(whereDay);

		// 异步删除图片 
		let cloudIds = dataUtil.getArrByKey(meet.MEET_PIC, 'cloudId');
		cloudUtil.deleteFiles(cloudIds);

		return;
	}

	/**获取信息 */
	async getMeetDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where, fields);
		if (!meet) return null;

		let meetService = new MeetService();
		meet.MEET_DAYS_SET = await meetService.getDaysSet(id, timeUtil.time('Y-M-D')); //今天及以后

		return meet;
	}

	/**
	 * 更新富文本详细的内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateMeetContent({
		meetId,
		content // 富文本数组
	}) {

		// 获取数据库里的图片数据
		let meet = await MeetModel.getOne(meetId, 'MEET_CONTENT');

		// 处理 新旧文件
		content = await cloudUtil.handlerCloudFilesByRichEditor(meet.MEET_CONTENT, content);

		//更新数据库
		let data = {
			MEET_CONTENT: content
		};
		await MeetModel.edit(meetId, data);

	}

	/**
	 * 更新封面内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateMeetStyleSet({
		meetId,
		styleSet
	}) {

		// 获取数据库里的图片数据
		let meet = await MeetModel.getOne(meetId, 'MEET_STYLE_SET');

		// 处理 新旧文件
		await cloudUtil.handlerCloudFiles([meet.MEET_STYLE_SET.pic], [styleSet.pic]);

		if (styleSet && styleSet.desc) {
			styleSet.desc = dataUtil.fmtText(styleSet.desc, 100);
		}

		//更新数据库
		let data = {
			MEET_STYLE_SET: styleSet
		};
		await MeetModel.edit(meetId, data);

	}

	/** 更新日期设置 */
	async _editDays(meetId, nowDay, daysSetData) {
		// 删除指定日期之后的记录（含)
		let where = {
			DAY_MEET_ID: meetId,
			day: ['>=', nowDay]
		}
		await DayModel.del(where);

		// 插入指定日期之后的记录
		for (let k in daysSetData) {
			daysSetData[k].DAY_MEET_ID = meetId;
		}
		await DayModel.insertBatch(daysSetData);
	}

	/**更新数据 */
	async editMeet({
		id,
		title,
		typeId,
		typeName,
		order,
		daysSet,
		isShowLimit,
		formSet
	}) {
		// 重复性判断
		let where = {
			MEET_TITLE: title,
			_id: ['<>', id]
		}
		if (await MeetModel.count(where))
			this.AppError('该标题已经存在');

		// 赋值 
		let data = {};
		data.MEET_TITLE = title;
		data.MEET_ORDER = order;
		data.MEET_TYPE_ID = typeId;
		data.MEET_TYPE_NAME = typeName;

		// 业务处理
		for (let k in daysSet) {
			// 时间段正序排列
			let times = daysSet[k].times;
			times.sort(dataUtil.objArrSortAsc('start'));
			daysSet[k].times = times;
		}

		data.MEET_IS_SHOW_LIMIT = isShowLimit;
		data.MEET_FORM_SET = formSet;

		data.MEET_DAYS = dataUtil.getArrByKey(daysSet, 'day');

		await MeetModel.edit(id, data);

		// 插入日期设置 (DAY表)
		await this._editDays(id, timeUtil.time('Y-M-D'), daysSet);

		// 人数统计修正
		this.statJoinCntByMeet(id);

	}

	/**预约名单分页列表 */
	async getJoinList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		meetId,
		mark,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'JOIN_EDIT_TIME': 'desc'
		};
		let fields = 'JOIN_IS_CHECKIN,JOIN_CODE,JOIN_ID,JOIN_REASON,JOIN_USER_ID,JOIN_MEET_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_MEET_TIME_MARK,JOIN_FORMS,JOIN_STATUS,JOIN_EDIT_TIME';

		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_TIME_MARK: mark
		};
		if (util.isDefined(search) && search) {
			where['JOIN_FORMS.val'] = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					sortVal = Number(sortVal);
					if (sortVal == 1099) //取消的2种
						where.JOIN_STATUS = ['in', [10, 99]]
					else
						where.JOIN_STATUS = Number(sortVal);
					break;
				case 'checkin':
					// 签到
					where.JOIN_STATUS = JoinModel.STATUS.SUCC;
					if (sortVal == 1) {
						where.JOIN_IS_CHECKIN = 1;
					} else {
						where.JOIN_IS_CHECKIN = 0;
					}
					break;
			}
		}

		return await JoinModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/**预约项目分页列表 */
	async getMeetList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		whereEx, //附加查询条件
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'MEET_ORDER': 'asc',
			'MEET_ADD_TIME': 'desc'
		};
		let fields = 'MEET_TYPE,MEET_TYPE_NAME,MEET_TITLE,MEET_STATUS,MEET_DAYS,MEET_ADD_TIME,MEET_EDIT_TIME,MEET_ORDER';

		let where = {};
		if (util.isDefined(search) && search) {
			where.MEET_TITLE = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					where.MEET_STATUS = Number(sortVal);
					break;
				case 'typeId':
					// 按类型
					where.MEET_TYPE_ID = sortVal;
					break;
				case 'sort':
					// 排序
					if (sortVal == 'view') {
						orderBy = {
							'MEET_VIEW_CNT': 'desc',
							'MEET_ADD_TIME': 'desc'
						};
					}

					break;
			}
		}

		return await MeetModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/** 删除 */
	async delJoin(joinId) {
		let join = await JoinModel.getOne(joinId);
		if (!join) this.AppError('找不到该记录');

		await JoinModel.del(joinId);


		// 重新统计  
		let meetService = new MeetService();
		await meetService.statJoinCnt(join.JOIN_MEET_ID, join.JOIN_MEET_TIME_MARK);

		// 返回统计信息
		let whereMeet = {
			_id: join.JOIN_MEET_ID
		}
		let meet = await meetService.getMeetOneDay(join.JOIN_MEET_ID, join.JOIN_MEET_DAY, whereMeet, 'MEET_ID');
		if (!meet) this.AppError('找不到该记录');
		let timeSet = meetService.getTimeSetByTimeMark(meet, join.JOIN_MEET_TIME_MARK);
		return timeSet.stat;

	}

	/**修改报名状态 
	 * 特殊约定 99=>正常取消 
	 */
	async statusJoin(admin, joinId, status, reason = '') {
		let where = {
			_id: joinId,
			JOIN_STATUS: ['<>', status]
		}
		let join = await JoinModel.getOne(where);
		if (!join) this.AppError('找不到该记录');

		let data = {
			JOIN_STATUS: status,
			JOIN_IS_CHECKIN: 0, //取消签到

			JOIN_REASON: (status == 99) ? dataUtil.fmtText(reason) : '',

			// 操作管理员信息记载
			JOIN_EDIT_ADMIN_ID: admin._id,
			JOIN_EDIT_ADMIN_NAME: admin.ADMIN_NAME,
			JOIN_EDIT_ADMIN_STATUS: status,
			JOIN_EDIT_ADMIN_TIME: this._timestamp
		}
		await JoinModel.edit(where, data);

		let meetService = new MeetService();

		// 重新统计  
		await meetService.statJoinCnt(join.JOIN_MEET_ID, join.JOIN_MEET_TIME_MARK);

		// 返回统计信息
		let whereMeet = {
			_id: join.JOIN_MEET_ID
		}
		let meet = await meetService.getMeetOneDay(join.JOIN_MEET_ID, join.JOIN_MEET_DAY, whereMeet, 'MEET_ID');

		if (!meet) this.AppError('找不到该记录');
		let timeSet = meetService.getTimeSetByTimeMark(meet, join.JOIN_MEET_TIME_MARK);
		return timeSet.stat;
	}

	/**修改项目状态 */
	async statusMeet(id, status) {
		let data = {
			MEET_STATUS: status
		}
		let where = {
			_id: id,
		}
		return await MeetModel.edit(where, data);
	}

	/**置顶排序设定 */
	async sortMeet(id, sort) {
		sort = Number(sort)
		let data = {
			MEET_ORDER: sort
		}
		await MeetModel.edit(id, data);
	}
}

module.exports = AdminMeetService;