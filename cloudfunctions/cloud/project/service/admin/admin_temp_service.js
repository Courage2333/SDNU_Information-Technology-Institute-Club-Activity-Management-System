/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-12-08 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const TempModel = require('../../model/temp_model.js');

class AdminTempService extends BaseAdminService {

	/**添加模板 */
	async insertTemp({
		name,
		times,
	}) {

		// 重复性判断
		let where = {
			TEMP_NAME: name,
		}
		if (await TempModel.count(where))
			this.AppError('该模板标题已经存在');

		// 赋值 
		let data = {};
		data.TEMP_NAME = name;
		data.TEMP_TIMES = times;

		let id = await TempModel.insert(data);

		return id;
	}

	/**更新数据 */
	async editTemp({
		id,
		limit,
		isLimit
	}) {


		// 赋值 
		let data = {};
		data['TEMP_TIMES.$[].limit'] = limit;
		data['TEMP_TIMES.$[].isLimit'] = isLimit;

		await TempModel.edit(id, data);

		return await this.getTempList();
	}


	/**删除数据 */
	async delTemp(id) {
		let where = {
			_id: id
		}

		await TempModel.del(where);
		return;
	}


	/**分页列表 */
	async getTempList() {
		let orderBy = {
			'TEMP_ADD_TIME': 'desc'
		};
		let fields = 'TEMP_NAME,TEMP_TIMES';

		let where = {};
		return await TempModel.getAll(where, fields, orderBy);
	}
}

module.exports = AdminTempService;