/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-12-08 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const timeUtil = require('../../../framework/utils/time_util.js');

const MeetModel = require('../../model/meet_model.js');
const JoinModel = require('../../model/join_model.js');
const UserModel = require('../../model/user_model.js');

const DataService = require('./../data_service');

// 导出报名数据KEY
const EXPORT_JOIN_DATA_KEY = 'join_data';

// 导出用户数据KEY
const EXPORT_USER_DATA_KEY = 'user_data';

class AdminExportService extends BaseAdminService {
	// #####################导出报名数据
	/**获取报名数据 */
	async getJoinDataURL() {
		let dataService = new DataService();
		return await dataService.getExportDataURL(EXPORT_JOIN_DATA_KEY);
	}

	/**删除报名数据 */
	async deleteJoinDataExcel() {
		let dataService = new DataService();
		return await dataService.deleteDataExcel(EXPORT_JOIN_DATA_KEY);
	}

	// 根据表单提取数据
	_getValByForm(arr, mark, title) {
		for (let k in arr) {
			if (arr[k].mark == mark) return arr[k].val;
			if (arr[k].title == title) return arr[k].val;
		}

		return '';
	}

	/**导出报名数据 */
	async exportJoinDataExcel({
		meetId,
		startDay,
		endDay,
		status
	}) {
		// 取得meet的表单设置
		let meet = await MeetModel.getOne(meetId, 'MEET_FORM_SET');
		if (!meet) return;
		let formSet = meet.MEET_FORM_SET;
		let formTitle = [];
		for (let k in formSet) {
			formTitle.push({
				column: formSet[k].title,
				wch: 30
			});
		}

		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_DAY: [
				['>=', startDay],
				['<=', endDay]
			]
		};
		if (status != 999)
			where.JOIN_STATUS = status;


		// 计算总数
		let total = await JoinModel.count(where);

		// 定义存储数据 
		let data = [];

		const options = {
			'!cols': [{
					column: '序号',
					wch: 8

				}, {
					column: '日期',
					wch: 15

				}, {
					column: '时段',
					wch: 28

				}, {
					column: '状态',
					wch: 18

				},
				...formTitle,
				{
					column: '预约时间',
					wch: 25

				},
				{
					column: '是否签到',
					wch: 15

				}
			]
		};

		// 标题栏
		let ROW_TITLE = options['!cols'].map((item) => (item.column));
		data.push(ROW_TITLE);

		// 按每次100条导出数据
		let size = 100;
		let page = Math.ceil(total / size);
		let orderBy = {
			'JOIN_MEET_TIME_START': 'asc',
			'JOIN_EDIT_TIME': 'asc'
		}

		let order = 0;
		for (let i = 1; i <= page; i++) {
			let list = await JoinModel.getList(where, '*', orderBy, i, size, false);
			console.log('[ExportJoin] Now export cnt=' + list.list.length);

			for (let k in list.list) {
				let node = list.list[k];

				order++;

				// 数据节点
				let arr = [];
				arr.push(order);

				arr.push(node.JOIN_MEET_DAY);
				arr.push(node.JOIN_MEET_TIME_START + '-' + node.JOIN_MEET_TIME_END);

				arr.push(JoinModel.getDesc('STATUS', node.JOIN_STATUS));

				// 表单
				for (let k in formSet) {
					arr.push(this._getValByForm(node.JOIN_FORMS, formSet[k].mark, formSet[k].title));
				}

				// 创建时间
				arr.push(timeUtil.timestamp2Time(node.JOIN_EDIT_TIME, 'Y-M-D h:m:s'));

				if (node.JOIN_STATUS == 1 && node.JOIN_IS_CHECKIN == 1) {
					arr.push('已签到')
				} else {
					arr.push('')
				}

				data.push(arr);
			}

		}

		let dataService = new DataService();

		return await dataService.exportDataExcel(EXPORT_JOIN_DATA_KEY, '报名数据', total, data, options);

	}


	// #####################导出用户数据

	/**获取用户数据 */
	async getUserDataURL() {
		let dataService = new DataService();
		return await dataService.getExportDataURL(EXPORT_USER_DATA_KEY);
	}

	/**删除用户数据 */
	async deleteUserDataExcel() {
		let dataService = new DataService();
		return await dataService.deleteDataExcel(EXPORT_USER_DATA_KEY);
	}

	/**导出用户数据 */
	async exportUserDataExcel(condition) {

		let where = {
			//USER_STATUS: ['in', '1,8']
		};

		if (condition) {
			where = JSON.parse(decodeURIComponent(condition));
		}

		// 计算总数
		let total = await UserModel.count(where);
		console.log('[ExportUser] TOTAL=' + total);

		// 定义存储数据 
		let data = [];

		const options = {
			'!cols': [{
				column: '序号',
				wch: 5

			}, {
				column: '姓名',
				wch: 12

			}, {
				column: '手机',
				wch: 15

			}, {
				column: '城市',
				wch: 30

			}, {
				column: '单位',
				wch: 30

			}, {
				column: '行业',
				wch: 30

			}, {
				column: '创建时间',
				wch: 20

			}]
		};

		// 标题栏
		let ROW_TITLE = options['!cols'].map((item) => (item.column));
		data.push(ROW_TITLE);

		// 按每次100条导出数据
		let size = 100;
		let page = Math.ceil(total / size);
		let orderBy = {
			'USER_ADD_TIME': 'desc'
		}

		let order = 0;
		for (let i = 1; i <= page; i++) {
			let list = await UserModel.getList(where, '*', orderBy, i, size, false);
			console.log('[ExportUser] Now export cnt=' + list.list.length);

			for (let k in list.list) {
				let node = list.list[k];

				order++;

				// 数据节点
				let arr = [];
				arr.push(order);

				arr.push(node.USER_NAME);
				arr.push(node.USER_MOBILE);
				arr.push(node.USER_CITY);
				arr.push(node.USER_WORK);
				arr.push(node.USER_TRADE);
 

				// 创建时间
				arr.push(timeUtil.timestamp2Time(node.USER_ADD_TIME, 'Y-M-D h:m:s'));

				data.push(arr)
			}

		}

		let dataService = new DataService();
		return await dataService.exportDataExcel(EXPORT_USER_DATA_KEY, '用户数据', total, data, options);

	}
}

module.exports = AdminExportService;